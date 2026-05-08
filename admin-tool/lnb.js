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

  function getTitleActiveStates() {
    return JSON.parse(localStorage.getItem('titleActiveStates') || '{}');
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
  function buildTitleAccordion(titleName, displayName, isActive) {
    const enc = encodeURIComponent(titleName);
    const bodyDisplay = isActive ? '' : ' style="display:none;"';
    const bodyClass = isActive ? 'accordion-body' : 'accordion-body d-none';
    const activeClass = isActive ? ' active' : '';

    return `
      <div class="accordion-item${activeClass}" data-title="${titleName}">
        <div class="accordion-header">
          <span>${displayName}</span>
          <span class="accordion-icon">▾</span>
        </div>
        <div class="${bodyClass}"${bodyDisplay}>
          <div class="nav-section">
            <ul class="nav-menu">
              <li class="nav-item"><a href="msg-mgmt.html?title=${enc}" class="nav-link" data-page="msg-mgmt.html">메시지 예약/관리</a></li>
              <li class="nav-item"><a href="event_mgmt.html?title=${enc}" class="nav-link" data-page="event_mgmt.html">이벤트 관리</a></li>
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
  function getTitleDisplayNames() {
    return JSON.parse(localStorage.getItem('titleDisplayNames') || '{}');
  }

  function buildSidebarHTML() {
    const currentPage = getCurrentPage();
    const currentTitle = getCurrentTitle();
    const customTitles = getCustomTitles();

    // 모든 타이틀 합치기 (비활성 제외, 저장된 순서 적용)
    const titleActiveStates = getTitleActiveStates();
    const titleDisplayNames = getTitleDisplayNames();
    const titleOrder = JSON.parse(localStorage.getItem('titleOrder') || 'null');

    let allTitles = [
      ...DEFAULT_TITLES,
      ...customTitles.map(name => ({ name, isDefault: false }))
    ].filter(t => titleActiveStates[t.name] !== false);

    if (titleOrder) {
      allTitles.sort((a, b) => {
        const ai = titleOrder.indexOf(a.name);
        const bi = titleOrder.indexOf(b.name);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    }

    // 타이틀별 페이지라면 해당 타이틀 아코디언을 활성화
    const titlePages = ['msg-mgmt.html', 'title_settings.html', 'message_write.html', 'message_detail.html', 'event_mgmt.html', 'event_write.html', 'event_detail.html'];
    const isTitlePage = titlePages.includes(currentPage);

    let accordionsHTML = '';
    allTitles.forEach(t => {
      const isActive = isTitlePage
        ? (currentTitle === t.name || (!currentTitle && t.name === 'RO1'))
        : (t.name === 'RO1');
      const displayName = titleDisplayNames[t.name] || t.name;
      accordionsHTML += buildTitleAccordion(t.name, displayName, isActive);
    });

    // 시스템 공통 관리 active 표시
    const isOperator = currentPage === 'operator_mgmt.html';
    const isLog = currentPage === 'activity_log.html';

    return `
      <div class="sidebar-header">
        <div style="display:flex; align-items:center;">
          <div class="sidebar-logo">
            <span class="sidebar-logo-text">GV</span>
          </div>
          <div>
            <h1 class="m-0"><a href="index.html" class="text-inherit">디스코드봇 운영 관리툴</a></h1>
          </div>
        </div>
        <button class="mobile-close-btn" id="mobileCloseBtn" aria-label="메뉴 닫기">
          &times;
        </button>
      </div>

      <div class="sidebar-content">
        ${accordionsHTML}

        <!-- 시스템 공통 관리 -->
        <div class="nav-section mt-24">
          <div class="nav-section-title">시스템 공통 관리</div>
          <ul class="nav-menu">
            <li class="nav-item">
              <a href="operator_mgmt.html" class="nav-link${isOperator ? ' active' : ''}">설정</a>
            </li>
            <li class="nav-item">
              <a href="activity_log.html" class="nav-link${isLog ? ' active' : ''}">활동 로그</a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Sidebar Footer User Profile -->
      <div class="sidebar-footer" style="position: relative; display: flex; align-items: center; justify-content: flex-end; gap: 4px; padding: 12px;">
        <!-- Notification Dropdown -->
        <div id="notiDropdown" class="noti-dropdown" style="display: none;">
          <div class="noti-header">
            <h4>알림 (1)</h4>
          </div>
          <div class="noti-tabs">
            <div class="noti-tab active">전체</div>
            <div class="noti-tab">읽지않음(0)</div>
            <div class="noti-read-all">모두 읽기</div>
          </div>
          <div class="noti-list">
            <!-- 동적으로 생성됩니다 -->
          </div>
          <div class="noti-footer">
            알림은 최근 30일까지만 보관됩니다.
          </div>
        </div>

        <button id="notiToggleBtn" class="noti-toggle-btn" title="알림" style="margin-right:0;">
          <img src="img/notification.svg" alt="알림" style="width:20px; height:20px;">
          <span class="noti-badge-dot"></span>
        </button>

        <a href="mypage.html" class="user-info text-decoration-none" style="display:flex; align-items:center; gap:8px;">
          <div class="user-icon">
            <img src="img/user.svg" alt="User" class="user-icon-white">
          </div>
          <div class="user-text">
            <span class="user-name">로컬 관리자</span>
          </div>
        </a>
        
        <a href="login.html" id="logoutBtn" class="logout-btn" title="로그아웃" style="margin-left: 8px;">
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
      // 알림 토글
      const notiBtn = e.target.closest('#notiToggleBtn');
      if (notiBtn) {
        const dropdown = document.getElementById('notiDropdown');
        if (dropdown) {
          dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
        }
      }

      // 모두 읽기
      if (e.target.closest('.noti-read-all')) {
        readAllNotifications();
      }

      // 외부 클릭 시 알림 닫기 로직은 document에 추가
    });

    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('notiDropdown');
      const notiBtn = document.getElementById('notiToggleBtn');
      if (dropdown && dropdown.style.display === 'flex') {
        if (!dropdown.contains(e.target) && (!notiBtn || !notiBtn.contains(e.target))) {
          dropdown.style.display = 'none';
        }
      }
    });
  }

  // ─── 모바일 헤더 HTML 생성 ───
  function buildMobileHeader() {
    return `
      <div class="mobile-header" id="mobileHeader">
        <div class="mobile-header-left">
          <div class="mobile-logo">GV</div>
          <span class="mobile-title">디스코드봇 운영 관리툴</span>
        </div>
        <button class="mobile-hamburger" id="mobileHamburger" aria-label="메뉴 열기">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
    `;
  }

  // ─── 모바일 메뉴 토글 ───
  function initMobileMenu() {
    const hamburger = document.getElementById('mobileHamburger');
    const sidebar = document.getElementById('lnb');
    const overlay = document.getElementById('sidebarOverlay');
    if (!hamburger || !sidebar || !overlay) return;

    function openMenu() {
      sidebar.classList.add('open');
      overlay.classList.add('show');
      hamburger.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
      hamburger.classList.remove('active');
      document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    overlay.addEventListener('click', closeMenu);

    const closeBtn = document.getElementById('mobileCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeMenu);
    }

    // 메뉴 항목 클릭 시 자동 닫기 (모바일)
    sidebar.addEventListener('click', (e) => {
      const link = e.target.closest('a.nav-link:not(.phase2-item)');
      if (link && window.innerWidth <= 1100) {
        closeMenu();
      }
    });

    // 화면 크기 변경 시 정리
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1100) {
        closeMenu();
      }
    });
  }

  // ─── 초기화 ───
  function initLNB() {
    const sidebar = document.getElementById('lnb');
    if (!sidebar) return;

    // 모바일 헤더 삽입 (아직 없으면)
    if (!document.getElementById('mobileHeader')) {
      document.body.insertAdjacentHTML('afterbegin', buildMobileHeader());
    }

    sidebar.className = 'sidebar';
    sidebar.innerHTML = buildSidebarHTML();
    highlightActiveLink(sidebar);
    bindEvents(sidebar);
    initMobileMenu();
    initNotifications();
  }

  function initNotifications() {
    const listEl = document.querySelector('.noti-list');
    const badgeDot = document.querySelector('.noti-badge-dot');
    const unreadTab = document.querySelector('.noti-tabs .noti-tab:nth-child(2)');
    const notiHeaderCount = document.querySelector('.noti-header h4');

    // Clean up old notifications (> 30 days)
    let notis = JSON.parse(localStorage.getItem('gv_notifications') || '[]');

    // Seed default if completely empty (for demonstration based on existing events)
    if (notis.length === 0) {
      const existingEvents = JSON.parse(localStorage.getItem('gv_events') || '[]');
      if (existingEvents.length > 0) {
        notis.push({
          id: Date.now(),
          type: 'warning',
          title: `RO1 · ${existingEvents[0].title}`,
          desc: '이벤트 쿠폰 잔여량이 10% 남았습니다.',
          date: new Date().toISOString(),
          isRead: false
        });
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    notis = notis.filter(n => new Date(n.date) >= thirtyDaysAgo);

    // Sort descending
    notis.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    localStorage.setItem('gv_notifications', JSON.stringify(notis));

    const unreadNotis = notis.filter(n => !n.isRead);
    const unreadCount = unreadNotis.length;

    if (badgeDot) {
      badgeDot.style.display = unreadCount > 0 ? 'block' : 'none';
    }
    if (unreadTab) {
      unreadTab.textContent = `읽지않음(${unreadCount})`;
    }
    if (notiHeaderCount) {
      notiHeaderCount.textContent = `알림 (${notis.length})`;
    }

    if (listEl) {
      if (notis.length === 0) {
        listEl.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px;">최근 30일 이내 알림이 없습니다.</div>';
      } else {
        listEl.innerHTML = notis.map(n => {
          let iconSvg = '';
          if (n.type === 'new_event') {
            iconSvg = '<img src="img/plus.svg" style="width:16px;height:16px;">';
          } else if (n.type === 'bot_msg') {
            iconSvg = '<img src="img/murmur.svg" style="width:16px;height:16px;">';
          } else if (n.type === 'warning') {
            iconSvg = '<img src="img/exclamation.svg" style="width:16px;height:16px;">';
          } else {
            // Fallback
            iconSvg = '<img src="img/notification.svg" style="width:16px;height:16px;">';
          }

          const timeStr = new Date(n.date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
          return `
            <div class="noti-item ${n.isRead ? '' : 'unread'}">
              <div class="noti-icon" style="display:flex; align-items:center; justify-content:center;">
                ${iconSvg}
              </div>
              <div class="noti-content">
                <div class="noti-title">${n.title}</div>
                <div class="noti-desc">${n.desc}</div>
              </div>
              <div class="noti-time">
                ${timeStr} ${n.isRead ? '' : '<span class="noti-unread-dot"></span>'}
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  function readAllNotifications() {
    let notis = JSON.parse(localStorage.getItem('gv_notifications') || '[]');
    notis.forEach(n => n.isRead = true);
    localStorage.setItem('gv_notifications', JSON.stringify(notis));
    initNotifications();
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
