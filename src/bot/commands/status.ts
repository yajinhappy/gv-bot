import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommand } from '../client';
import { getMessageStats } from '../../db/schema';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('예약 메시지 현황 확인'),

  async execute(interaction: ChatInputCommandInteraction) {
    const stats = getMessageStats();

    const embed = new EmbedBuilder()
      .setTitle('📊 메시지 예약 현황')
      .setColor(0x00549D)
      .addFields(
        { name: '📨 예약 대기', value: `${stats.pending ?? 0}건`, inline: true },
        { name: '✅ 발송 완료', value: `${stats.sent ?? 0}건`, inline: true },
        { name: '📋 전체', value: `${stats.total ?? 0}건`, inline: true },
      )
      .setFooter({ text: 'GV DiscordBot Admin' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
