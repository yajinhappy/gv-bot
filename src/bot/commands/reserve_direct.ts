import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { SlashCommand } from '../client';
import { pendingReservations } from '../shared/pendingStore';
import { getUserTimezone } from '../../db/schema';
import { parseScheduledTime } from '../shared/utils';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('예약_직접발송')
    .setDescription('직접 작성한 메시지를 예약 발송합니다')
    .addChannelOption(option =>
      option
        .setName('발송채널')
        .setDescription('메시지를 발송할 채널')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('메시지내용')
        .setDescription('발송할 메시지 내용 (디스코드 마크다운 지원)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('시간')
        .setDescription('발송 시간 (예: 2026-05-01 14:30 또는 2026-05-01 오후 2:30). 미입력 시 즉시발송')
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option
        .setName('이미지')
        .setDescription('첨부할 이미지 파일')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('이미지링크')
        .setDescription('이미지 클릭 시 이동할 URL')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const targetChannel = interaction.options.getChannel('발송채널', true);
    const content = interaction.options.getString('메시지내용', true);
    const scheduledTime = interaction.options.getString('시간');
    const attachment = interaction.options.getAttachment('이미지');
    const clickUrl = interaction.options.getString('이미지링크');

    // 시간이 입력된 경우 형식 검증
    let isImmediate = false;
    let displayTime = '';

    if (scheduledTime) {
      const parsedTime = parseScheduledTime(scheduledTime);
      if (!parsedTime) {
        await interaction.reply({
          content: '❌ 시간 형식이 올바르지 않습니다.\n예: `2026-05-01 14:30`, `2026-05-01 02:30 PM`, `2026-05-01 오후 2:30`',
          ephemeral: true,
        });
        return;
      }

      const scheduledDate = new Date(parsedTime.replace(' ', 'T'));
      if (scheduledDate <= new Date()) {
        await interaction.reply({
          content: '❌ 예약 시간은 현재보다 미래여야 합니다.',
          ephemeral: true,
        });
        return;
      }
      displayTime = parsedTime;
    } else {
      isImmediate = true;
      displayTime = '확인 즉시 발송';
    }

    // 이미지 URL 추출
    const imageUrl = attachment?.url || null;

    // 이미지 형식 검증
    if (attachment) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(attachment.contentType || '')) {
        await interaction.reply({
          content: '❌ 지원하지 않는 이미지 형식입니다. (JPG, PNG, GIF, WEBP만 지원)',
          ephemeral: true,
        });
        return;
      }
    }

    // 미리보기 Embed
    const embed = new EmbedBuilder()
      .setTitle(isImmediate ? '📋 즉시발송 미리보기' : '📋 예약 미리보기')
      .setColor(isImmediate ? 0xED4245 : 0x00549D)
      .addFields(
        { name: '📢 발송 채널', value: `<#${targetChannel.id}>`, inline: true },
        { name: '⏰ 발송 시간', value: displayTime, inline: true },
      )
      .setDescription(content.length > 1024 ? content.substring(0, 1021) + '...' : content)
      .setFooter({ text: `요청자: ${interaction.user.tag}` })
      .setTimestamp();

    if (imageUrl) {
      embed.setImage(imageUrl);
    }

    if (clickUrl) {
      embed.addFields({ name: '🔗 이미지 링크', value: clickUrl, inline: false });
    }

    // 버튼 생성
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('rsv_confirm')
        .setLabel('확인')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('rsv_cancel')
        .setLabel('취소')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('rsv_test')
        .setLabel('발송 테스트')
        .setStyle(ButtonStyle.Secondary),
    );

    const response = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    // 현재 시간 (즉시발송용)
    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 대기 중인 예약 정보 저장 (메모리)
    pendingReservations.set(response.id, {
      channelId: targetChannel.id,
      content,
      link: null,
      imageUrl,
      clickUrl: clickUrl || null,
      scheduledAt: displayTime === '확인 즉시 발송' ? nowStr : displayTime,
      timezone: getUserTimezone(interaction.user.id),
      userId: interaction.user.id,
      userName: interaction.user.tag,
      interactionMessageId: response.id,
      isImmediate,
    });
  },
};

export default command;
