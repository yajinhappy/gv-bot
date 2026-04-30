/**
 * 사용자 입력 시간을 파싱하여 표준 24시간제(YYYY-MM-DD HH:mm) 형식으로 변환
 * 지원 형식:
 * 2026-05-01 14:30
 * 2026-05-01 02:30 PM
 * 2026-05-01 오후 2:30
 */
export function parseScheduledTime(input: string): string | null {
  const regex = /^(\d{4}-\d{2}-\d{2})\s+(?:(AM|PM|am|pm|오전|오후)\s*)?(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm|오전|오후))?$/;
  const match = input.trim().match(regex);
  if (!match) return null;

  const datePart = match[1];
  const ampm1 = match[2];
  let hours = parseInt(match[3], 10);
  const minutes = match[4];
  const ampm2 = match[5];

  const ampm = (ampm1 || ampm2 || '').toLowerCase();

  if (ampm === 'pm' || ampm === '오후') {
    if (hours < 12) hours += 12;
  } else if (ampm === 'am' || ampm === '오전') {
    if (hours === 12) hours = 0;
  } else {
    // am/pm이 없으면 24시간제로 취급
    if (hours > 23) return null;
  }

  if (hours > 23 || parseInt(minutes, 10) > 59) return null;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');

  return `${datePart} ${hh}:${mm}`;
}
