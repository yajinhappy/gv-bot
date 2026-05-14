/**
 * GV DiscordBot Admin Tool — API 클라이언트
 * 관리자페이지에서 봇 API 서버와 통신하는 공통 모듈
 */

const API_CONFIG = {
  BASE_URL: window.location.origin.includes('localhost') ? 'http://localhost:3001/api' : '/api',
  API_KEY: 'gv-admin-secret-key-change-in-production',
};

const EVENT_BOT_API_CONFIG = {
  BASE_URL: window.location.origin.includes('localhost') ? 'http://localhost:3002/api' : '/event-api',
  API_KEY: 'gv-admin-secret-key-change-in-production',
};

// ─── 토큰 관리 ──────────────────────────

function getAuthToken() {
  return localStorage.getItem('gv_auth_token');
}

function setAuthToken(token) {
  localStorage.setItem('gv_auth_token', token);
}

function removeAuthToken() {
  localStorage.removeItem('gv_auth_token');
  localStorage.removeItem('gv_user');
}

function getStoredUser() {
  const raw = localStorage.getItem('gv_user');
  return raw ? JSON.parse(raw) : null;
}

function setStoredUser(user) {
  localStorage.setItem('gv_user', JSON.stringify(user));
}

/**
 * API 요청 공통 함수
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': API_CONFIG.API_KEY,
  };

  // JWT 토큰이 있으면 Authorization 헤더 추가
  const token = getAuthToken();
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      headers: { ...defaultHeaders, ...options.headers },
      ...options,
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || `HTTP ${response.status}`);
    }

    return json;
  } catch (error) {
    if (error.message === 'Failed to fetch') {
      console.error('API 서버에 연결할 수 없습니다. 봇 서버가 실행 중인지 확인하세요.');
      throw new Error('API 서버에 연결할 수 없습니다.');
    }
    throw error;
  }
}

// ─── 인증 API ──────────────────────────

/**
 * 로그인
 */
async function apiLogin(loginId, password) {
  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ loginId, password }),
  });
  if (result.success && result.data) {
    setAuthToken(result.data.token);
    setStoredUser(result.data.user);
  }
  return result;
}

/**
 * 회원가입 (계정 생성 요청)
 */
async function apiSignup(data) {
  const result = await apiRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result;
}

/**
 * 현재 로그인 사용자 정보 조회
 */
async function apiGetMe() {
  const result = await apiRequest('/auth/me');
  return result;
}

/**
 * 로그아웃
 */
function apiLogout() {
  removeAuthToken();
  window.location.href = 'login.html';
}

/**
 * 비밀번호 변경
 */
async function apiChangePassword(currentPassword, newPassword) {
  const result = await apiRequest('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return result;
}

/**
 * 인증 가드 — 로그인 필요 페이지에서 호출
 * 토큰이 없거나 만료되면 로그인 페이지로 이동
 */
async function requireAuth() {
  // 로컬 개발/테스트 환경에서는 로그인 우회
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') {
    const userNameEl = document.querySelector('.user-name');
    if (userNameEl) userNameEl.textContent = '로컬 관리자';
    return { name: '로컬 관리자', loginId: 'local_admin' };
  }

  const token = getAuthToken();
  if (!token) {
    window.location.href = 'login.html';
    return null;
  }
  try {
    const result = await apiGetMe();
    if (result.success) {
      setStoredUser(result.data);
      // 사이드바 사용자명 업데이트
      const userNameEl = document.querySelector('.user-name');
      if (userNameEl) userNameEl.textContent = result.data.name;
      
      // 권한 등급이 변경되었을 수 있으므로 LNB 새로고침
      if (typeof window.refreshLNB === 'function') {
        window.refreshLNB();
      }
      return result.data;
    }
  } catch {
    removeAuthToken();
    window.location.href = 'login.html';
  }
  return null;
}

// ─── 채널 API ──────────────────────────

/**
 * Discord 서버의 텍스트 채널 목록 조회
 */
async function fetchChannels() {
  const result = await apiRequest('/channels');
  return result.data;
}

/**
 * Discord 서버의 역할(Role) 목록 조회
 */
async function apiFetchRoles() {
  const result = await apiRequest('/channels/roles');
  return result.data;
}

// ─── 메시지 API ──────────────────────────

/**
 * 예약 메시지 목록 조회 (필터/검색/페이지네이션)
 */
async function fetchMessages(params = {}) {
  const query = new URLSearchParams(params).toString();
  const result = await apiRequest(`/messages${query ? '?' + query : ''}`);
  return result;
}

/**
 * 메시지 상세 조회
 */
async function fetchMessageById(id) {
  const result = await apiRequest(`/messages/${id}`);
  return result.data;
}

/**
 * 예약 메시지 등록
 */
async function createMessage(payload) {
  const result = await apiRequest('/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result;
}

/**
 * 예약 메시지 수정
 */
async function updateMessage(id, payload) {
  const result = await apiRequest(`/messages/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return result;
}

/**
 * 예약 메시지 취소
 */
async function cancelMessage(id) {
  const result = await apiRequest(`/messages/${id}/cancel`, {
    method: 'PATCH',
  });
  return result;
}

/**
 * 예약 메시지 삭제
 */
async function deleteMessage(id) {
  const result = await apiRequest(`/messages/${id}`, {
    method: 'DELETE',
  });
  return result;
}

/**
 * 즉시 발송
 */
async function sendMessageNow(payload) {
  const result = await apiRequest('/messages/send-now', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result;
}

/**
 * 통계 조회
 */
async function fetchMessageStats() {
  const result = await apiRequest('/messages/stats/summary');
  return result.data;
}

// ─── 운영자 API ──────────────────────────

async function fetchOperators() {
  const result = await apiRequest('/auth/operators');
  return result.data;
}

async function updateOperatorStatus(id, status) {
  const result = await apiRequest(`/auth/operators/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return result;
}

async function apiUpdateOperatorGame(id, game) {
  const result = await apiRequest(`/auth/operators/${id}/game`, {
    method: 'PATCH',
    body: JSON.stringify({ game }),
  });
  return result;
}

async function apiFetchTitlePermsMap(title) {
  const result = await apiRequest(`/auth/title-perms/${encodeURIComponent(title)}`);
  return result.data || {};
}

async function apiSetTitlePerms(operatorId, title, perms) {
  const result = await apiRequest(`/auth/operators/${operatorId}/title-perms/${encodeURIComponent(title)}`, {
    method: 'PUT',
    body: JSON.stringify(perms),
  });
  return result;
}

// ─── 활동 로그 API ──────────────────────────

/**
 * 활동 로그 목록 조회 (필터/검색/페이지네이션)
 */
async function fetchActivityLogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  const result = await apiRequest(`/logs${query ? '?' + query : ''}`);
  return result;
}

/**
 * 활동 로그 대상 타이틀 목록 (필터용)
 */
async function fetchActivityLogTitles() {
  const result = await apiRequest('/logs/titles');
  return result.data;
}

// ─── API 상태 확인 ──────────────────────────

/**
 * API 서버 연결 상태 확인
 */
async function checkApiHealth() {
  try {
    const healthUrl = window.location.origin.includes('localhost') ? 'http://localhost:3001/health' : '/health';
    const response = await fetch(healthUrl);
    const json = await response.json();
    return json.status === 'ok';
  } catch {
    return false;
  }
}

// ─── 이벤트봇 API ──────────────────────────

async function eventBotApiRequest(endpoint, options = {}) {
  const url = `${EVENT_BOT_API_CONFIG.BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': EVENT_BOT_API_CONFIG.API_KEY,
        ...options.headers,
      },
      ...options,
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || `HTTP ${response.status}`);
    return json;
  } catch (error) {
    if (error.message === 'Failed to fetch') throw new Error('이벤트봇 API 서버에 연결할 수 없습니다.');
    throw error;
  }
}

/**
 * 이벤트봇을 통해 쿠폰 DM 발송
 */
async function sendCouponDm(eventTitle, targets) {
  return await eventBotApiRequest('/events/send-coupon-dm', {
    method: 'POST',
    body: JSON.stringify({ eventTitle, targets }),
  });
}

// ─── 알림 푸시 ──────────────────────────

/**
 * 알림을 localStorage gv_notifications에 push
 * type: 'new_event' | 'bot_msg' | 'warning'
 */
function pushNotification({ type, title, desc }) {
  const notis = JSON.parse(localStorage.getItem('gv_notifications') || '[]');
  notis.unshift({
    id: Date.now(),
    type,
    title,
    desc,
    date: new Date().toISOString(),
    isRead: false
  });
  localStorage.setItem('gv_notifications', JSON.stringify(notis));
}

console.log('✅ API 클라이언트 로드 완료');
