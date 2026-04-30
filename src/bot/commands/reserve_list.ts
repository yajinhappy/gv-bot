import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { SlashCommand } from '../client';
import { getMessagesByUserId } from '../../db/schema';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('예약내역')
    .setDescription('내가 등록한 예약 메시지 목록을 확인합니다'),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const reservations = getMessagesByUserId(userId);

    if (reservations.length === 0) {
      await interaction.reply({
        content: '📭 현재 대기 중인 예약이 없습니다.',
        ephemeral: true,
      });
      return;
    }

    // 최대 10개까지 표시
    const displayItems = reservations.slice(0, 10);

    const embed = new EmbedBuilder()
      .setTitle('📋 내 예약 목록')
      .setColor(0x00549D)
      .setDescription(`총 **${reservations.length}건**의 대기 중인 예약이 있습니다.`)
      .setFooter({ text: `${interaction.user.tag} 의 예약 목록` })
      .setTimestamp();

    displayItems.forEach((rsv, index) => {
      const contentPreview = rsv.content.length > 50
        ? rsv.content.substring(0, 47) + '...'
        : rsv.content;

      embed.addFields({
        name: `#${rsv.id} | ⏰ ${rsv.scheduled_at}`,
        value: `📢 <#${rsv.channel_id}>\n📝 ${contentPreview}\n🔖 상태: 예약 대기`,
        inline: false,
      });
    });

    // 각 예약에 대한 수정/취소 버튼 (최대 5개만 버튼 표시 — Discord 제한)
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    for (let i = 0; i < Math.min(displayItems.length, 5); i++) {
      const rsv = displayItems[i];
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`list_cancel_${rsv.id}`)
          .setLabel(`#${rsv.id} 취소`)
          .setStyle(ButtonStyle.Danger),
      );
      rows.push(row);
    }

    await interaction.reply({
      embeds: [embed],
      components: rows,
      ephemeral: true,
    });
  },
};

export default command;
