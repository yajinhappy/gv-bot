import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { SlashCommand } from '../client';
import { getDb, saveDatabase, nowKST } from '../../db/schema';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('이미지인증이벤트')
    .setDescription('이미지 인증 이벤트에 참여합니다.')
    .addStringOption(opt =>
      opt
        .setName('내용')
        .setDescription('참여 내용을 입력해주세요')
        .setRequired(true)
    )
    .addAttachmentOption(opt =>
      opt
        .setName('이미지')
        .setDescription('인증할 이미지를 첨부해주세요')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const db = getDb();
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const userTag = interaction.user.tag;
    const userName = interaction.user.displayName || interaction.user.username;
    const content = interaction.options.getString('내용') || '';
    const attachment = interaction.options.getAttachment('이미지', true);
    const now = nowKST();
    const nowIso = now.replace(' ', 'T');

    // 이미지 파일 체크
    if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
      await interaction.editReply('❌ 이미지 파일만 첨부할 수 있습니다. (jpg, png, gif 등)');
      return;
    }

    // 현재 채널에서 진행 중인 이미지 이벤트 검색
    const evtResults = db.exec(
      `SELECT * FROM events 
       WHERE type = 'image' 
         AND channel_id = ? 
         AND status = 'active' 
         AND start_date <= ? 
         AND end_date >= ?
       ORDER BY created_at DESC LIMIT 1`,
      [channelId, nowIso, nowIso]
    );

    if (!evtResults || evtResults.length === 0 || evtResults[0].values.length === 0) {
      await interaction.editReply('❌ 이 채널에서 진행 중인 이미지 인증 이벤트가 없습니다.');
      return;
    }

    const cols = evtResults[0].columns;
    const row = evtResults[0].values[0];
    const evt: any = {};
    cols.forEach((c: string, i: number) => { evt[c] = row[i]; });

    // 중복 참여 체크
    const dupCheck = db.exec(
      `SELECT COUNT(*) FROM event_participants WHERE event_id = ? AND user_id = ?`,
      [evt.id, userId]
    );
    if (dupCheck && dupCheck[0] && (dupCheck[0].values[0][0] as number) > 0) {
      await interaction.editReply('✅ 이미 참여한 이벤트입니다.');
      return;
    }

    // 참여 기록 저장
    db.run(
      `INSERT INTO event_participants (event_id, user_id, user_tag, user_name, content, image_url, joined_at, status)
       VALUES (?, ?, ?, ?, '', ?, ?, '대기')`,
      [evt.id, userId, userTag, userName, content, attachment.url, now]
    );
    saveDatabase();

    const embed = new EmbedBuilder()
      .setTitle('📸 이미지 인증 완료!')
      .setDescription(`**${evt.title}** 이벤트에 이미지가 제출되었습니다.\n관리자 검토 후 쿠폰이 발송됩니다.`)
      .setImage(attachment.url)
      .addFields(
        { name: '참여 시간', value: now, inline: true }
      )
      .setColor(0x16a34a)
      .setFooter({ text: 'GV DiscordBot Event System' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
