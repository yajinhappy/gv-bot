/**
 * 메시지 공유 데이터 저장소
 * msg-mgmt.html, message_detail.html, message_write.html에서 공통 참조
 */
const MESSAGE_DATA = [
  {
    no: 15,
    status: '예약 대기',
    channel: '# 공지사항, # 이벤트안내',
    author: 'admin_01',
    createdAt: '2026-04-28 14:00:00',
    scheduledAt: '2026-04-30 10:00:00',
    completedAt: null,
    images: 2,
    link: 'https://ro.gnjoy.com/notice/update',
    body: '5월 정기 업데이트 안내 공지입니다.\n\n점검 시간은 오전 6시부터 오후 2시까지이며, 점검 중에는 게임 접속이 불가합니다.\n\n**주요 업데이트 내용:**\n- 신규 던전 잊혀진 신전 추가\n- 전사/마법사 계열 스킬 밸런스 조정\n- UI/UX 개선 (인벤토리 정렬, 파티 매칭)\n- 봄 시즌 한정 코스튬 5종 출시\n\n점검 보상으로 경험치 부스트 아이템이 지급될 예정입니다.\n자세한 사항은 공식 홈페이지를 확인해 주세요.\n\n감사합니다.'
  },
  {
    no: 14,
    status: '예약 대기',
    channel: '# 이벤트안내',
    author: 'event_mgr',
    createdAt: '2026-04-28 10:15:00',
    scheduledAt: '2026-04-29 18:00:00',
    completedAt: null,
    images: 1,
    link: '',
    body: '주말 핫타임 이벤트가 곧 시작됩니다!\n이번 주말 동안 경험치와 드랍률이 2배 상승합니다.\n\n놓치지 마세요!'
  },
  {
    no: 13,
    status: '발송 완료',
    channel: '# 업데이트',
    author: 'dev_team',
    createdAt: '2026-04-27 09:00:00',
    scheduledAt: '2026-04-28 14:00:00',
    completedAt: '2026-04-28 14:00:05',
    images: 0,
    link: 'https://ro.gnjoy.com/update/patch',
    body: '신규 캐릭터 밸런스 패치 노트\n\n자세한 패치 내역은 아래 링크를 참조해 주세요.'
  },
  {
    no: 12,
    status: '예약 취소',
    channel: '# 일반-수다',
    author: 'gm_ro',
    createdAt: '2026-04-26 15:00:00',
    scheduledAt: '2026-04-27 12:00:00',
    completedAt: null,
    images: 0,
    link: '',
    body: '안녕하세요 모험가 여러분!\n오늘 점심은 다들 무엇을 드시나요?'
  },
  {
    no: 11,
    status: '발송 완료',
    channel: '# 이벤트안내',
    author: 'event_mgr',
    createdAt: '2026-04-26 11:45:00',
    scheduledAt: '2026-04-26 12:00:00',
    completedAt: '2026-04-26 12:00:03',
    images: 3,
    link: 'https://ro.gnjoy.com/event/coupon',
    body: '돌발 이벤트! 선착순 쿠폰 번호를 공개합니다.\n지금 바로 접속하여 보상을 수령하세요!\n\n쿠폰 코드: SPRINGRO2026\n유효기간: 2026-04-26 ~ 2026-04-30'
  },
  {
    no: 10,
    status: '발송 완료',
    channel: '# 공지사항',
    author: 'sys_op',
    createdAt: '2026-04-25 08:00:00',
    scheduledAt: '2026-04-25 09:00:00',
    completedAt: '2026-04-25 09:00:02',
    images: 0,
    link: '',
    body: '서버 임시 점검이 완료되었습니다.\n점검 보상 아이템이 우편함으로 지급되었으니 확인 바랍니다.\n\n감사합니다.'
  },
  {
    no: 9,
    status: '발송 완료',
    channel: '# 공지사항',
    author: 'admin_01',
    createdAt: '2026-04-24 16:30:00',
    scheduledAt: '2026-04-24 17:00:00',
    completedAt: '2026-04-24 17:00:01',
    images: 1,
    link: 'https://ro.gnjoy.com/notice/maintenance',
    body: '긴급 서버 점검 안내\n\n금일 18:00 ~ 20:00 사이 긴급 서버 점검이 진행됩니다.\n점검 중에는 게임 접속이 불가하오니 양해 부탁드립니다.'
  },
  {
    no: 8,
    status: '예약 취소',
    channel: '# 이벤트안내',
    author: 'event_mgr',
    createdAt: '2026-04-23 14:00:00',
    scheduledAt: '2026-04-24 10:00:00',
    completedAt: null,
    images: 2,
    link: '',
    body: '봄맞이 복귀 유저 환영 이벤트!\n\n30일 이상 미접속 유저 대상 특별 보상이 지급됩니다.\n기간: 2026-04-25 ~ 2026-05-10'
  },
  {
    no: 7,
    status: '발송 완료',
    channel: '# 업데이트',
    author: 'dev_team',
    createdAt: '2026-04-22 11:00:00',
    scheduledAt: '2026-04-22 14:00:00',
    completedAt: '2026-04-22 14:00:04',
    images: 0,
    link: 'https://ro.gnjoy.com/update/hotfix',
    body: '핫픽스 패치 안내\n\n- 던전 진입 오류 수정\n- 특정 스킬 데미지 계산 오류 수정\n- NPC 대화 누락 문제 해결'
  },
  {
    no: 6,
    status: '발송 완료',
    channel: '# 공지사항, # 이벤트안내',
    author: 'admin_01',
    createdAt: '2026-04-21 09:00:00',
    scheduledAt: '2026-04-21 10:00:00',
    completedAt: '2026-04-21 10:00:02',
    images: 4,
    link: 'https://ro.gnjoy.com/event/spring',
    body: '🌸 봄 시즌 대규모 이벤트 안내 🌸\n\n1. 체리블로썸 던전 오픈\n2. 시즌 한정 의상 판매\n3. 출석 체크 보상 강화\n4. 길드전 보상 2배\n\n자세한 내용은 공식 홈페이지를 확인해주세요.'
  },
  {
    no: 5,
    status: '발송 완료',
    channel: '# 공지사항',
    author: 'sys_op',
    createdAt: '2026-04-20 07:00:00',
    scheduledAt: '2026-04-20 08:00:00',
    completedAt: '2026-04-20 08:00:01',
    images: 0,
    link: '',
    body: '정기 서버 점검 완료 안내\n\n금일 정기 서버 점검이 완료되었습니다.\n정상적으로 접속 가능하오니 확인 바랍니다.'
  },
  {
    no: 4,
    status: '예약 취소',
    channel: '# 일반-수다',
    author: 'gm_ro',
    createdAt: '2026-04-19 13:00:00',
    scheduledAt: '2026-04-19 15:00:00',
    completedAt: null,
    images: 0,
    link: '',
    body: 'GM과 함께하는 자유 대화 시간!\n\n이번 주 금요일 오후 3시부터 GM이 서버에 접속합니다.\n자유롭게 대화 나눠요!'
  },
  {
    no: 3,
    status: '발송 완료',
    channel: '# 업데이트',
    author: 'dev_team',
    createdAt: '2026-04-18 10:00:00',
    scheduledAt: '2026-04-18 14:00:00',
    completedAt: '2026-04-18 14:00:03',
    images: 1,
    link: 'https://ro.gnjoy.com/update/april',
    body: '4월 대규모 업데이트 안내\n\n신규 필드 몬스터 등장 및 장비 시스템이 개편됩니다.\n패치 노트는 링크를 참조해 주세요.'
  },
  {
    no: 2,
    status: '발송 완료',
    channel: '# 이벤트안내',
    author: 'event_mgr',
    createdAt: '2026-04-17 09:00:00',
    scheduledAt: '2026-04-17 12:00:00',
    completedAt: '2026-04-17 12:00:02',
    images: 2,
    link: 'https://ro.gnjoy.com/event/easter',
    body: '🐣 이스터 에그 헌트 이벤트!\n\n필드 곳곳에 숨겨진 이스터 에그를 찾아보세요.\n특별 보상이 가득합니다!\n\n이벤트 기간: 2026-04-17 ~ 2026-04-24'
  },
  {
    no: 1,
    status: '발송 완료',
    channel: '# 공지사항',
    author: 'admin_01',
    createdAt: '2026-04-16 08:00:00',
    scheduledAt: '2026-04-16 09:00:00',
    completedAt: '2026-04-16 09:00:01',
    images: 0,
    link: '',
    body: '디스코드 봇 운영 관리 시스템이 정식 가동됩니다.\n앞으로 모든 공지는 이 채널을 통해 전달될 예정입니다.\n\n감사합니다.'
  }
];

/**
 * ID로 메시지 조회
 */
function getMessageById(id) {
  return MESSAGE_DATA.find(m => m.no === parseInt(id));
}

/**
 * 채널 목록 추출 (필터용)
 */
function getUniqueChannels() {
  const channels = new Set();
  MESSAGE_DATA.forEach(m => {
    m.channel.split(', ').forEach(ch => channels.add(ch.trim()));
  });
  return Array.from(channels).sort();
}
