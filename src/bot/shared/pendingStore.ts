/**
 * 대기 중인 예약 정보 (확인 버튼 클릭 전 메모리 보관)
 */
export interface PendingReservation {
  channelId: string;
  content: string;
  link: string | null;
  imageUrl: string | null;
  clickUrl: string | null;
  scheduledAt: string;
  timezone: string;
  userId: string;
  userName: string;
  interactionMessageId: string;
  isImmediate?: boolean;
}

/**
 * 봇 응답 메시지 ID → PendingReservation 매핑
 * 사용자가 "확인" 또는 "취소" 클릭 시 해당 정보를 가져옴
 */
export const pendingReservations = new Map<string, PendingReservation>();

/**
 * 10분 후 자동 만료 (미확인 예약 자동 정리)
 */
export function scheduleExpiry(messageId: string, timeoutMs: number = 10 * 60 * 1000) {
  setTimeout(() => {
    if (pendingReservations.has(messageId)) {
      pendingReservations.delete(messageId);
      console.log(`⏳ 대기 예약 만료 삭제: ${messageId}`);
    }
  }, timeoutMs);
}
