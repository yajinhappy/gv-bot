import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../client';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('봇 응답속도 확인'),

  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({
      content: '측정 중...',
      fetchReply: true,
    });

    const latency = sent.createdTimestamp - interaction.createdTimestamp;

    await interaction.editReply(
      `🏓 Pong! 응답속도: **${latency}ms** | WebSocket: **${interaction.client.ws.ping}ms**`
    );
  },
};

export default command;
