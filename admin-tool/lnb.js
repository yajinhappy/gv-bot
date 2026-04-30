/**
 * LNB (Left Navigation Bar) 공통 모듈
 * 모든 페이지에서 동일한 사이드바를 동적으로 렌더링합니다.
 * 
 * 사용법:  각 HTML 페이지의 <aside id="lnb"></aside> 위치에 자동 삽입
 *          <script src="lnb.js"></script> 를 body 하단에 추가
 */

(function () {
  'use strict';

  // ─── 기본 타이틀 목록 (하드코딩 대체) ───
  const DEFAULT_TITLES = [
    { name: 'RO1', isDefault: true },
    { name: 'Ragnarok Monster Kitchen', isDefault: true }
  ];

  // ─── 유틸리티 ───
  function getCustomTitles() {
    return JSON.parse(localStorage.getItem('customTitles') || '[]');
  }

  function getCurrentPage() {
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf('/') + 1) || 'index.html';
  }

  function getCurrentTitle() {
    const params = new URLSearchParams(window.location.search);
    return params.get('title') || null;
  }

  // ─── 타이틀 아코디언 HTML 생성 ───
  function buildTitleAccordion(titleName, isActive) {
    const enc = encodeURIComponent(titleName);
    const bodyDisplay = isActive ? '' : ' style="display:none;"';
    const bodyClass = isActive ? 'accordion-body' : 'accordion-body d-none';
    const activeClass = isActive ? ' active' : '';

    return `
      <div class="accordion-item${activeClass}" data-title="${titleName}">
        <div class="accordion-header">
          <span>${titleName}</span>
          <span class="accordion-icon">▾</span>
        </div>
        <div class="${bodyClass}"${bodyDisplay}>
          <div class="nav-section">
            <ul class="nav-menu">
              <li class="nav-item"><a href="msg-mgmt.html?title=${enc}" class="nav-link" data-page="msg-mgmt.html">메시지 예약/관리</a></li>
              <li class="nav-item"><a href="#" class="nav-link phase2-item">이벤트 관리 <span class="badge-p2">WIP</span></a></li>
              <li class="nav-item"><a href="#" class="nav-link phase2-item">SNS 미러링 관리 <span class="badge-p2">WIP</span></a></li>
              <li class="nav-item"><a href="#" class="nav-link phase2-item">FAQ 자동응답 <span class="badge-p2">WIP</span></a></li>
            </ul>
          </div>
          <div class="nav-section mb-0">
            <ul class="nav-menu">
              <li class="nav-item"><a href="title_settings.html?title=${enc}" class="nav-link" data-page="title_settings.html">타이틀별 설정</a></li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  // ─── 전체 사이드바 HTML 생성 ───
  function buildSidebarHTML() {
    const currentPage = getCurrentPage();
    const currentTitle = getCurrentTitle();
    const customTitles = getCustomTitles();

    // 모든 타이틀 목록 합치기
    const allTitles = [
      ...DEFAULT_TITLES,
      ...customTitles.map(name => ({ name, isDefault: false }))
    ];

    // 타이틀별 페이지라면 해당 타이틀 아코디언을 활성화
    const titlePages = ['msg-mgmt.html', 'title_settings.html', 'message_write.html', 'message_detail.html'];
    const isTitlePage = titlePages.includes(currentPage);

    let accordionsHTML = '';
    allTitles.forEach(t => {
      const isActive = isTitlePage
        ? (currentTitle === t.name || (!currentTitle && t.name === 'RO1'))
        : (t.name === 'RO1'); // 타이틀 무관 페이지에서는 RO1을 기본 열림
      accordionsHTML += buildTitleAccordion(t.name, isActive);
    });

    // 시스템 공통 관리 active 표시
    const isOperator = currentPage === 'operator_mgmt.html';
    const isLog = currentPage === 'activity_log.html';

    return `
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <span class="sidebar-logo-text">GV</span>
        </div>
        <div>
          <h1 class="m-0"><a href="index.html" class="text-inherit">디스코드봇 운영 관리툴</a></h1>
        </div>
      </div>

      <div class="sidebar-content">
        ${accordionsHTML}

        <!-- 시스템 공통 관리 -->
        <div class="nav-section mt-24">
          <div class="nav-section-title">시스템 공통 관리</div>
          <ul class="nav-menu">
            <li class="nav-item">
              <a href="operator_mgmt.html" class="nav-link${isOperator ? ' active' : ''}">운영자 관리</a>
            </li>
            <li class="nav-item">
              <a href="activity_log.html" class="nav-link${isLog ? ' active' : ''}">활동 로그</a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Sidebar Footer User Profile -->
      <div class="sidebar-footer">
        <a href="mypage.html" class="user-info text-decoration-none">
          <div class="user-icon">
            <img src="img/user.svg" alt="User" class="user-icon-white">
          </div>
          <div class="user-text">
            <span class="user-name">김그라</span>
          </div>
        </a>
        <a href="login.html" id="logoutBtn" class="logout-btn" title="로그아웃">
          <img src="img/logout.svg" alt="로그아웃" class="logout-icon">
        </a>
      </div>
    `;
  }

  // ─── 활성 링크 하이라이팅 ───
  function highlightActiveLink(sidebar) {
    const currentPage = getCurrentPage();
    const currentTitle = getCurrentTitle();

    sidebar.querySelectorAll('.nav-link[data-page]').forEach(link => {
      const linkPage = link.getAttribute('data-page');
      const linkTitle = link.closest('[data-title]');
      const titleName = linkTitle ? linkTitle.getAttribute('data-title') : null;

      if (linkPage === currentPage) {
        // 타이틀도 일치해야 active
        if (titleName === currentTitle || (!currentTitle && titleName === 'RO1')) {
          link.classList.add('active');
        }
      }
    });
  }

  // ─── 이벤트 바인딩 (이벤트 위임) ───
  function bindEvents(sidebar) {
    sidebar.addEventListener('click', (e) => {
      // Phase 2 (WIP) 메뉴 클릭 차단
      if (e.target.closest('.phase2-item')) {
        e.preventDefault();
        alert('준비중입니다.');
        return;
      }

      // 아코디언 토글
      const header = e.target.closest('.accordion-header');
      if (header) {
        const accordion = header.closest('.accordion-item');
        if (accordion) {
          accordion.classList.toggle('active');
          const body = accordion.querySelector('.accordion-body');
          if (body) {
            if (accordion.classList.contains('active')) {
              body.style.display = 'block';
              body.classList.remove('d-none');
            } else {
              body.style.display = 'none';
            }
          }
        }
      }
    });
  }

  // ─── 초기화 ───
  function initLNB() {
    const sidebar = document.getElementById('lnb');
    if (!sidebar) return;

    sidebar.className = 'sidebar';
    sidebar.innerHTML = buildSidebarHTML();
    highlightActiveLink(sidebar);
    bindEvents(sidebar);
  }

  // DOM 준비 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLNB);
  } else {
    initLNB();
  }

  // 외부에서 LNB 재렌더링할 수 있도록 전역 함수 노출
  window.refreshLNB = initLNB;
})();
