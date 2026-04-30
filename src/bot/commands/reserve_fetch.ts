import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { SlashCommand } from '../client';
import { pendingReservations } from '../shared/pendingStore';
import { getUserTimezone } from '../../db/schema';
import { parseScheduledTime } from '../shared/utils';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('예약_불러오기')
    .setDescription('기존 메시지를 불러와서 예약 발송합니다')
    .addChannelOption(option =>
      option
        .setName('발송채널')
        .setDescription('메시지를 발송할 채널')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('메시지링크')
        .setDescription('불러올 메시지의 링크 (우클릭 → 메시지 링크 복사)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('시간')
        .setDescription('발송 시간 (예: 2026-05-01 14:30 또는 2026-05-01 오후 2:30)')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const targetChannel = interaction.options.getChannel('발송채널', true);
    const messageLink = interaction.options.getString('메시지링크', true);
    const scheduledTime = interaction.options.getString('시간', true);

    // 시간 파싱 (AM/PM 지원)
    const parsedTime = parseScheduledTime(scheduledTime);
    if (!parsedTime) {
      await interaction.reply({
        content: '❌ 시간 형식이 올바르지 않습니다.\n예: `2026-05-01 14:30`, `2026-05-01 02:30 PM`, `2026-05-01 오후 2:30`',
        ephemeral: true,
      });
      return;
    }

    // 과거 시간 검증
    const scheduledDate = new Date(parsedTime.replace(' ', 'T'));
    if (scheduledDate <= new Date()) {
      await interaction.reply({
        content: '❌ 예약 시간은 현재보다 미래여야 합니다.',
        ephemeral: true,
      });
      return;
    }

    // 메시지 링크 파싱
    const linkRegex = /discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
    const match = messageLink.match(linkRegex);

    if (!match) {
      await interaction.reply({
        content: '❌ 올바른 메시지 링크가 아닙니다.\n디스코드에서 메시지를 우클릭 → "메시지 링크 복사"로 가져오세요.',
        ephemeral: true,
      });
      return;
    }

    const [, guildId, channelId, messageId] = match;

    // 원본 메시지 가져오기
    try {
      const sourceChannel = await interaction.client.channels.fetch(channelId);
      if (!sourceChannel || !(sourceChannel instanceof TextChannel)) {
        await interaction.reply({ content: '❌ 원본 채널을 찾을 수 없습니다.', ephemeral: true });
        return;
      }

      const sourceMessage = await sourceChannel.messages.fetch(messageId);
      const content = sourceMessage.content || '(내용 없음)';
      const imageUrl = sourceMessage.attachments.first()?.url || null;

      // 미리보기 Embed 생성
      const embed = new EmbedBuilder()
        .setTitle('📋 예약 미리보기')
        .setColor(0x00549D)
        .addFields(
          { name: '📢 발송 채널', value: `<#${targetChannel.id}>`, inline: true },
          { name: '⏰ 발송 시간', value: parsedTime, inline: true },
          { name: '📝 원본 메시지', value: `[원본 보기](${messageLink})`, inline: true },
        )
        .setDescription(content.length > 1024 ? content.substring(0, 1021) + '...' : content)
        .setFooter({ text: `요청자: ${interaction.user.tag}` })
        .setTimestamp();

      if (imageUrl) {
        embed.setImage(imageUrl);
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

      // 대기 중인 예약 정보 저장 (메모리)
      pendingReservations.set(response.id, {
        channelId: targetChannel.id,
        content,
        link: messageLink,
        imageUrl,
        clickUrl: null,
        scheduledAt: parsedTime,
        timezone: getUserTimezone(interaction.user.id),
        userId: interaction.user.id,
        userName: interaction.user.tag,
        interactionMessageId: response.id,
      });

    } catch (error) {
      console.error('메시지 불러오기 실패:', error);
      await interaction.reply({
        content: '❌ 원본 메시지를 불러올 수 없습니다. 링크를 확인해주세요.',
        ephemeral: true,
      });
    }
  },
};

export default command;
