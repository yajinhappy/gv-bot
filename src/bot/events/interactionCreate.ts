import {
  Events,
  Interaction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { client } from '../client';
import { pendingReservations } from '../shared/pendingStore';
import { insertMessage, cancelMessageById, markAsSent, setUserTimezone } from '../../db/schema';

client.on(Events.InteractionCreate, async (interaction: Interaction) => {

  // ─── 슬래시 커맨드 처리 ──────────────────
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`❌ 커맨드 없음: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('커맨드 실행 오류:', error);
      const reply = { content: '커맨드 실행 중 오류가 발생했습니다.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
    return;
  }

  // ─── 버튼 인터랙션 처리 ──────────────────
  if (interaction.isButton()) {
    const customId = interaction.customId;

    // ── 예약 확인 버튼 ──
    if (customId === 'rsv_confirm') {
      const pending = pendingReservations.get(interaction.message.id);

      if (!pending) {
        await interaction.reply({ content: '❌ 예약 정보가 만료되었습니다. 다시 명령어를 실행해주세요.', ephemeral: true });
        return;
      }

      // 본인 확인
      if (pending.userId !== interaction.user.id) {
        await interaction.reply({ content: '❌ 예약 등록자만 확인할 수 있습니다.', ephemeral: true });
        return;
      }

      try {
        if (pending.isImmediate) {
          // 즉시 발송
          const channel = await client.channels.fetch(pending.channelId);
          if (channel && channel instanceof TextChannel) {
            let messageContent = pending.content;
            if (pending.link) messageContent += `\n\n🔗 ${pending.link}`;

            if (pending.imageUrl && pending.clickUrl) {
              // 이미지 + 클릭 URL → 임베드로 전송
              const imgEmbed = new EmbedBuilder()
                .setDescription(messageContent)
                .setImage(pending.imageUrl)
                .setURL(pending.clickUrl);
              await channel.send({ embeds: [imgEmbed] });
            } else if (pending.imageUrl) {
              await channel.send({ content: messageContent, files: [pending.imageUrl] });
            } else {
              await channel.send({ content: messageContent });
            }
          }

          // DB에 기록 (sent 상태로)
          const id = insertMessage({
            channelId: pending.channelId,
            content: pending.content,
            link: pending.link,
            imageUrl: pending.imageUrl,
            clickUrl: pending.clickUrl,
            scheduledAt: pending.scheduledAt,
            timezone: pending.timezone,
            author: pending.userName,
            userId: pending.userId,
            interactionMessageId: pending.interactionMessageId,
          });
          markAsSent(id);

          // 버튼 비활성화
          const disabledRow = createDisabledButtons();
          const successEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0x57F287)
            .setTitle('✅ 즉시 발송 완료');

          await interaction.update({ embeds: [successEmbed], components: [disabledRow] });

        } else {
          // 예약 등록
          const id = insertMessage({
            channelId: pending.channelId,
            content: pending.content,
            link: pending.link,
            imageUrl: pending.imageUrl,
            clickUrl: pending.clickUrl,
            scheduledAt: pending.scheduledAt,
            timezone: pending.timezone,
            author: pending.userName,
            userId: pending.userId,
            interactionMessageId: pending.interactionMessageId,
          });

          // 버튼 비활성화
          const disabledRow = createDisabledButtons();
          const successEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0x57F287)
            .setTitle(`✅ 예약 확정 (ID: #${id})`);

          await interaction.update({ embeds: [successEmbed], components: [disabledRow] });
        }

        // 메모리에서 제거
        pendingReservations.delete(interaction.message.id);

      } catch (error) {
        console.error('예약 확인 처리 오류:', error);
        await interaction.reply({ content: '❌ 처리 중 오류가 발생했습니다.', ephemeral: true });
      }
      return;
    }

    // ── 예약 취소 버튼 ──
    if (customId === 'rsv_cancel') {
      const pending = pendingReservations.get(interaction.message.id);

      if (!pending) {
        await interaction.reply({ content: '❌ 예약 정보가 만료되었습니다.', ephemeral: true });
        return;
      }

      if (pending.userId !== interaction.user.id) {
        await interaction.reply({ content: '❌ 예약 등록자만 취소할 수 있습니다.', ephemeral: true });
        return;
      }

      // 버튼 비활성화
      const disabledRow = createDisabledButtons();
      const cancelledEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0xED4245)
        .setTitle('❌ 예약 취소됨');

      await interaction.update({ embeds: [cancelledEmbed], components: [disabledRow] });
      pendingReservations.delete(interaction.message.id);
      return;
    }

    // ── 발송 테스트 버튼 ──
    if (customId === 'rsv_test') {
      const pending = pendingReservations.get(interaction.message.id);

      if (!pending) {
        await interaction.reply({ content: '❌ 예약 정보가 만료되었습니다.', ephemeral: true });
        return;
      }

      // Ephemeral 미리보기 (본인에게만 표시)
      const previewEmbed = new EmbedBuilder()
        .setTitle('🔍 발송 테스트 미리보기')
        .setColor(0xFEE75C)
        .setDescription(pending.content)
        .addFields(
          { name: '📢 발송 채널', value: `<#${pending.channelId}>`, inline: true },
          { name: '⏰ 발송 시간', value: pending.isImmediate ? '즉시 발송' : pending.scheduledAt, inline: true },
        )
        .setFooter({ text: '이 메시지는 본인에게만 보입니다 (Ephemeral)' });

      if (pending.link) {
        previewEmbed.addFields({ name: '🔗 링크', value: pending.link, inline: false });
      }
      if (pending.imageUrl) {
        previewEmbed.setImage(pending.imageUrl);
      }

      await interaction.reply({ embeds: [previewEmbed], ephemeral: true });
      return;
    }

    // ── 예약 목록에서 취소 버튼 ──
    if (customId.startsWith('list_cancel_')) {
      const reservationId = parseInt(customId.replace('list_cancel_', ''));

      if (isNaN(reservationId)) {
        await interaction.reply({ content: '❌ 잘못된 요청입니다.', ephemeral: true });
        return;
      }

      const changes = cancelMessageById(reservationId);

      if (changes === 0) {
        await interaction.reply({
          content: '❌ 취소 불가: 이미 발송되었거나 존재하지 않는 예약입니다.',
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: `✅ 예약 #${reservationId} 이(가) 취소되었습니다.`,
        ephemeral: true,
      });
      return;
    }

    // ── 시간대 설정 버튼 ──
    if (customId.startsWith('tz_set_')) {
      const offset = customId.replace('tz_set_', '');
      try {
        setUserTimezone(interaction.user.id, offset);
        await interaction.reply({
          content: `✅ 기본 시간대가 **${offset}** (으)로 설정되었습니다.\n이제부터 메시지 예약 시 이 시간대가 적용됩니다.`,
          ephemeral: true,
        });
      } catch (error) {
        console.error('시간대 설정 오류:', error);
        await interaction.reply({ content: '❌ 설정 중 오류가 발생했습니다.', ephemeral: true });
      }
      return;
    }
  }
});

/**
 * 비활성화된 버튼 행 생성
 */
function createDisabledButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('rsv_confirm')
      .setLabel('확인')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('rsv_cancel')
      .setLabel('취소')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('rsv_test')
      .setLabel('발송 테스트')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );
}
