import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { SlashCommand } from '../client';
import { getDb, saveDatabase, nowKST } from '../../db/schema';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('이벤트')
    .setDescription('현재 진행 중인 일반(텍스트) 이벤트에 참여합니다.')
    .addStringOption(opt =>
      opt
        .setName('내용')
        .setDescription('참여 메시지 (선택)')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const db = getDb();
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const userTag = interaction.user.tag;
    const userName = interaction.user.displayName || interaction.user.username;
    const content = interaction.options.getString('내용') || '참여 완료!';
    const now = nowKST(); // YYYY-MM-DD HH:mm:ss
    // datetime-local input is formatted as YYYY-MM-DDTHH:mm
    // To properly compare, convert now to match the 'T' format.
    const nowIso = now.replace(' ', 'T'); 
    const todayDate = now.slice(0, 10);

    const commandUsed = '/' + interaction.commandName;

    // 현재 채널에서 진행 중인 텍스트 이벤트 검색 (커맨드명 일치 포함)
    const evtResults = db.exec(
      `SELECT * FROM events
       WHERE type = 'text'
         AND channel_id = ?
         AND status = 'active'
         AND start_date <= ?
         AND end_date >= ?
         AND (command_name IS NULL OR command_name = '' OR command_name = ?)
       ORDER BY created_at DESC LIMIT 1`,
      [channelId, nowIso, nowIso, commandUsed]
    );

    if (!evtResults || evtResults.length === 0 || evtResults[0].values.length === 0) {
      // 커맨드명이 달라서 못 찾은 건지 확인
      const anyEvt = db.exec(
        `SELECT command_name FROM events
         WHERE type = 'text' AND channel_id = ? AND status = 'active'
           AND start_date <= ? AND end_date >= ?
         ORDER BY created_at DESC LIMIT 1`,
        [channelId, nowIso, nowIso]
      );
      if (anyEvt?.length && anyEvt[0].values.length) {
        const correctCmd = anyEvt[0].values[0][0] || '/이벤트';
        await interaction.editReply(`❌ 올바른 커맨드가 아닙니다.\n이벤트 참여 커맨드: **${correctCmd}**`);
      } else {
        await interaction.editReply('❌ 이 채널에서 진행 중인 이벤트가 없습니다.');
      }
      return;
    }

    const cols = evtResults[0].columns;
    const row = evtResults[0].values[0];
    const evt: any = {};
    cols.forEach((c: string, i: number) => { evt[c] = row[i]; });

    // 데일리 반복 시간 체크
    if (evt.daily === 'on') {
      const nowTime = now.slice(11, 16); // HH:mm
      const start = evt.daily_start || '00:00';
      const end = evt.daily_end || '23:59';
      if (nowTime < start || nowTime > end) {
        await interaction.editReply(
          `⏰ 참여 가능 시간이 아닙니다.\n참여 가능: **${start}** ~ **${end}**`
        );
        return;
      }
    }

    // 오늘 이미 참여했는지 체크 (데일리 반복일 때)
    if (evt.daily === 'on') {
      const dupCheck = db.exec(
        `SELECT COUNT(*) FROM event_participants 
         WHERE event_id = ? AND user_id = ? AND DATE(joined_at) = ?`,
        [evt.id, userId, todayDate]
      );
      if (dupCheck && dupCheck[0] && (dupCheck[0].values[0][0] as number) > 0) {
        await interaction.editReply('✅ 오늘은 이미 참여했습니다. 내일 다시 참여해 주세요!');
        return;
      }
    } else {
      // 비반복 이벤트 — 중복 참여 체크
      const dupCheck = db.exec(
        `SELECT COUNT(*) FROM event_participants WHERE event_id = ? AND user_id = ?`,
        [evt.id, userId]
      );
      if (dupCheck && dupCheck[0] && (dupCheck[0].values[0][0] as number) > 0) {
        await interaction.editReply('✅ 이미 참여한 이벤트입니다.');
        return;
      }
    }

    // 재고 체크
    if (evt.cpn_type === 'individual') {
      const pool: string[] = evt.cpn_codes_pool ? JSON.parse(evt.cpn_codes_pool) : [];
      if (pool.length === 0) {
        await interaction.editReply('❌ 이벤트 쿠폰이 모두 소진되었습니다.');
        return;
      }
    } else if (evt.cpn_stock === 'limited') {
      const issued = evt.cpn_issued || 0;
      const limit = evt.cpn_stock_limit || 0;
      if (issued >= limit) {
        await interaction.editReply('❌ 이벤트 쿠폰이 모두 소진되었습니다.');
        return;
      }
    }

    // 참여 기록 저장
    db.run(
      `INSERT INTO event_participants (event_id, user_id, user_tag, user_name, content, joined_at, status)
       VALUES (?, ?, ?, ?, ?, ?, '대기')`,
      [evt.id, userId, userTag, userName, content, now]
    );
    const ptcIdRes = db.exec('SELECT last_insert_rowid()');
    const ptcId = ptcIdRes[0].values[0][0] as number;
    saveDatabase();

    // 자동 쿠폰 DM 발송
    let dmSent = false;
    let couponCode: string | null = null;

    if (evt.coupon_method === 'auto') {
      if (evt.cpn_type === 'single' && evt.cpn_code) {
        couponCode = evt.cpn_code;
      } else if (evt.cpn_type === 'individual' && evt.cpn_codes_pool) {
        try {
          const pool: string[] = JSON.parse(evt.cpn_codes_pool);
          if (pool.length > 0) {
            couponCode = pool.shift()!;
            db.run('UPDATE events SET cpn_codes_pool = ? WHERE id = ?', [JSON.stringify(pool), evt.id]);
          }
        } catch { /* pool 파싱 오류 무시 */ }
      }
    }

    if (couponCode) {
      try {
        const dm = await interaction.user.createDM();
        const cpnEmbed = new EmbedBuilder()
          .setTitle('🎉 쿠폰 발급 — ' + evt.title)
          .setDescription(`축하합니다! 이벤트에 참여하셨습니다.\n\n**쿠폰 코드:** \`${couponCode}\``)
          .setColor(0x16a34a)
          .setFooter({ text: 'GV DiscordBot Event System' })
          .setTimestamp();
        await dm.send({ embeds: [cpnEmbed] });
        dmSent = true;
        db.run(
          `UPDATE event_participants SET coupon_code = ?, status = '발송 완료' WHERE id = ?`,
          [couponCode, ptcId]
        );
        db.run('UPDATE events SET cpn_issued = cpn_issued + 1 WHERE id = ?', [evt.id]);
        saveDatabase();
      } catch (e) {
        console.error('DM 발송 실패:', e);
        // 개별 코드를 꺼냈지만 DM 실패 → 다시 풀에 반납
        if (evt.cpn_type === 'individual' && couponCode) {
          try {
            const pool: string[] = evt.cpn_codes_pool ? JSON.parse(evt.cpn_codes_pool) : [];
            pool.unshift(couponCode);
            db.run('UPDATE events SET cpn_codes_pool = ? WHERE id = ?', [JSON.stringify(pool), evt.id]);
            saveDatabase();
          } catch { /* 무시 */ }
        }
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🎉 이벤트 참여 완료!')
      .setDescription(`**${evt.title}** 이벤트에 참여되었습니다.`)
      .addFields(
        { name: '참여 내용', value: content, inline: true },
        { name: '참여 시간', value: now, inline: true }
      )
      .setColor(0x0b5cff)
      .setFooter({ text: 'GV DiscordBot Event System' })
      .setTimestamp();

    if (evt.coupon_method === 'auto' && couponCode && !dmSent) {
      embed.addFields({ name: '⚠️ 쿠폰 DM', value: 'DM 발송에 실패했습니다. Discord 설정에서 DM 허용 여부를 확인해 주세요.' });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
