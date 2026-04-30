/**
 * 예약 메시지 타입
 */
export interface ScheduledMessage {
  id: number;
  channel_id: string;       // Discord 채널 ID (다중 채널일 경우 콤마 구분)
  content: string;           // 메시지 본문 (마크다운)
  link: string | null;       // 첨부 링크 (선택)
  scheduled_at: string;      // ISO 8601 예약 시간
  timezone: string;          // 기준 시간대 (e.g. "GMT+09:00")
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  author: string;            // 등록자 ID
  created_at: string;
  sent_at: string | null;    // 실제 발송 시각
}

/**
 * Discord 채널 정보
 */
export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  guildId: string;
}

/**
 * API 응답 공통 형식
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}
