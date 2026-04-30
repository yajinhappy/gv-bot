import { Events, Message, PartialMessage, TextChannel } from 'discord.js';
import { client } from '../client';
import { cancelByInteractionMessageId } from '../../db/schema';
import { pendingReservations } from '../shared/pendingStore';

/**
 * 2-4. 예약 자동 취소
 * 사용자가 예약 명령어 메시지(봇 응답)를 삭제하면
 * 해당 메시지에 연결된 대기 중 예약을 자동 파기
 */
client.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
  // 봇 자신의 메시지가 삭제된 경우만 처리
  if (!message.author?.bot && message.author?.id !== client.user?.id) return;

  const messageId = message.id;

  // 1) 메모리 대기 예약 제거
  if (pendingReservations.has(messageId)) {
    const pending = pendingReservations.get(messageId)!;
    pendingReservations.delete(messageId);
    console.log(`🗑️ 대기 예약 자동 삭제 (메시지 삭제): ${messageId}`);

    // DM으로 알림
    try {
      const user = await client.users.fetch(pending.userId);
      await user.send(
        `⚠️ **예약 자동 취소 안내**\n\n예약 명령어 메시지가 삭제되어 대기 중이던 예약이 자동 취소되었습니다.\n\n📢 채널: <#${pending.channelId}>\n⏰ 예정 시간: ${pending.scheduledAt}\n📝 내용: ${pending.content.substring(0, 100)}${pending.content.length > 100 ? '...' : ''}`
      );
    } catch (dmError) {
      console.warn('DM 전송 실패 (권한 없음 등):', dmError);
    }
    return;
  }

  // 2) DB에 저장된 예약 취소
  const cancelledMessages = cancelByInteractionMessageId(messageId);

  if (cancelledMessages.length > 0) {
    console.log(`🗑️ DB 예약 자동 취소 (메시지 삭제): ${cancelledMessages.length}건`);

    for (const msg of cancelledMessages) {
      // DM 알림
      if (msg.user_id) {
        try {
          const user = await client.users.fetch(msg.user_id);
          await user.send(
            `⚠️ **예약 자동 취소 안내**\n\n예약 명령어 메시지가 삭제되어 예약 #${msg.id}이(가) 자동 취소되었습니다.\n\n📢 채널: <#${msg.channel_id}>\n⏰ 예정 시간: ${msg.scheduled_at}\n📝 내용: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
          );
        } catch (dmError) {
          console.warn('DM 전송 실패:', dmError);
        }
      }
    }
  }
});
