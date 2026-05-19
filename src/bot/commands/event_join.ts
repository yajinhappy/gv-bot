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
        .setDescription('참여 메시지')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const db = getDb();
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const userTag = interaction.user.tag;
    const userName = interaction.user.displayName || interaction.user.username;
    const content = interaction.options.getString('내용', true);
    const now = nowKST();
    const nowCompare = now.substring(0, 16);
    const todayDate = now.slice(0, 10);

    const evtResults = db.exec(
      `SELECT * FROM events
       WHERE type = 'text'
         AND channel_id = ?
         AND status = 'active'
         AND start_date <= ?
         AND end_date >= ?
       ORDER BY created_at DESC LIMIT 1`,
      [channelId, nowCompare, nowCompare]
    );

    if (!evtResults || evtResults.length === 0 || evtResults[0].values.length === 0) {
      await interaction.editReply('❌ 이 채널에서 진행 중인 이벤트가 없습니다.');
      return;
    }

    const cols = evtResults[0].columns;
    const row = evtResults[0].values[0];
    const evt: any = {};
    cols.forEach((c: string, i: number) => { evt[c] = row[i]; });

    if (evt.command_name) {
      const expected = (evt.command_name as string).replace(/^\//, '').trim();
      const entered = content.replace(/^\//, '').trim();
      if (entered !== expected) {
        await interaction.editReply(
          `❌ 참여 내용이 올바르지 않습니다.\n슬래시 커맨드에 맞는 내용을 입력해 주세요.`
        );
        return;
      }
    }

    if (evt.daily === 'on') {
      const nowTime = now.slice(11, 16);
      const start = evt.daily_start || '00:00';
      const end = evt.daily_end || '23:59';
      if (nowTime < start || nowTime > end) {
        await interaction.editReply(
          `⏰ 참여 가능 시간이 아닙니다.\n참여 가능: **${start}** ~ **${end}**`
        );
        return;
      }
    }

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
      const dupCheck = db.exec(
        `SELECT COUNT(*) FROM event_participants WHERE event_id = ? AND user_id = ?`,
        [evt.id, userId]
      );
      if (dupCheck && dupCheck[0] && (dupCheck[0].values[0][0] as number) > 0) {
        await interaction.editReply('✅ 이미 참여한 이벤트입니다.');
        return;
      }
    }

    if (evt.cpn_type === 'individual') {
      if (evt.cpn_codes_pool != null) {
        try {
          const pool: string[] = JSON.parse(evt.cpn_codes_pool);
          if (pool.length === 0) {
            await interaction.editReply('❌ 이벤트 쿠폰이 모두 소진되었습니다.');
            return;
          }
        } catch { /* 파싱 오류 시 소진 체크 건너뜀 */ }
      }
    } else if (evt.cpn_stock === 'limited') {
      const issued = evt.cpn_issued || 0;
      const limit = evt.cpn_stock_limit || 0;
      if (limit > 0 && issued >= limit) {
        await interaction.editReply('❌ 이벤트 쿠폰이 모두 소진되었습니다.');
        return;
      }
    }

    db.run(
      `INSERT INTO event_participants (event_id, user_id, user_tag, user_name, content, joined_at, status)
       VALUES (?, ?, ?, ?, ?, ?, '대기')`,
      [evt.id, userId, userTag, userName, content, now]
    );
    const ptcIdRes = db.exec('SELECT last_insert_rowid()');
    const ptcId = ptcIdRes[0].values[0][0] as number;
    saveDatabase();

    let dmSent = false;
    let couponCode: string | null = null;

    if (evt.coupon_method === 'auto') {
      if (evt.cpn_type === 'single' && evt.cpn_code) {
        couponCode = evt.cpn_code;
      } else if (evt.cpn_type === 'individual') {
        console.log(`[이벤트 ${evt.id}] cpn_codes_pool:`, evt.cpn_codes_pool);
        if (evt.cpn_codes_pool) {
          try {
            const pool: string[] = JSON.parse(evt.cpn_codes_pool);
            console.log(`[이벤트 ${evt.id}] 풀 잔여 코드 수:`, pool.length);
            if (pool.length > 0) {
              couponCode = pool.shift()!;
              db.run('UPDATE events SET cpn_codes_pool = ? WHERE id = ?', [JSON.stringify(pool), evt.id]);
            }
          } catch (e) {
            console.error(`[이벤트 ${evt.id}] pool 파싱 오류:`, e);
          }
        }
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
    } else if (evt.coupon_method === 'auto' && !couponCode && evt.cpn_type === 'individual') {
      embed.addFields({ name: '⚠️ 쿠폰 DM', value: '등록된 쿠폰 코드가 없습니다. 이벤트를 다시 등록해 주세요.' });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
