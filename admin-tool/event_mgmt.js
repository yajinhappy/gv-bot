/**
 * event_mgmt.js — 이벤트 목록 (테이블 리스트)
 */
(function () {
  'use strict';
  const EVT_KEY = 'gv_events';
  const PTC_KEY = 'gv_participants';
  const PER_PAGE = 15;
  let allEvents = [], filtered = [];
  let currentPage = 1, statusFilter = 'all', dateStart = '', dateEnd = '';

  function S(n) { return String(n).padStart(2,'0'); }
  function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  function nowKSTIso() {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
  }

  function getEvtStatus(e) {
    if (e.status === 'inactive') return 'inactive';
    const now = nowKSTIso();
    if (now < e.startDate) return 'upcoming';
    if (now > e.endDate) return 'ended';
    return 'running';
  }
  function statusBadge(s) {
    if (s==='running') return '<span class="status-badge connected">진행 중</span>';
    if (s==='upcoming') return '<span class="status-badge" style="background:#EFF6FF;color:var(--primary-color);">예정</span>';
    return '<span class="status-badge" style="background:#F5F5F5;color:#71717A;">종료</span>';
  }
  function typeLabel(t) { return t === 'text' ? '일반 이벤트' : '이미지 인증'; }

  async function init() {
    const title = new URLSearchParams(location.search).get('title') || 'RO1';
    document.getElementById('pageTitle').textContent = title + ' - 이벤트 관리';

    // 등록 버튼
    const enc = encodeURIComponent(title);
    const nbtn = document.getElementById('evtNewBtn');
    if (nbtn) nbtn.setAttribute('href', 'event_write.html?title=' + enc);
    const fab = document.getElementById('evtNewFab');
    if (fab) fab.setAttribute('href', 'event_write.html?title=' + enc);

    const user = await requireAuth();
    
    // 쓰기 권한 체크: view-only이면 등록 버튼 숨김
    try {
      const permsMap = await apiFetchTitlePermsMap(title);
      const myPerms = user && user.loginId ? permsMap[user.loginId] : null;
      if (myPerms && !myPerms.evtAll && !myPerms.evtManage) {
        if (nbtn) nbtn.style.display = 'none';
        if (fab) fab.style.display = 'none';
        window._isEvtViewOnly = true;
      } else {
        window._isEvtViewOnly = false;
      }
    } catch (e) { 
      console.warn('권한 체크 실패:', e); 
      window._isEvtViewOnly = false;
    }

    fetch((window.API_CONFIG ? window.API_CONFIG.BASE_URL : '/api') + '/events', {
      headers: {
        'x-api-key': window.API_CONFIG ? window.API_CONFIG.API_KEY : '',
        'Authorization': 'Bearer ' + localStorage.getItem('gv_auth_token')
      }
    })
    .then(r => r.json())
    .then(res => {
      allEvents = (res.events || []).map(e => ({
        id: e.id,
        type: e.type,
        title: e.title,
        desc: e.description,
        announceMsg: e.announce_msg,
        startDate: e.start_date,
        endDate: e.end_date,
        channel: e.channel_id,
        command: e.command_name,
        daily: e.daily,
        dailyStart: e.daily_start,
        dailyEnd: e.daily_end,
        couponMethod: e.coupon_method,
        cpnType: e.cpn_type,
        cpnCode: e.cpn_code,
        cpnStock: e.cpn_stock,
        cpnStockLimit: e.cpn_stock_limit,
        memo: e.memo,
        status: e.status,
        author: e.author,
        createdAt: e.created_at,
        participantCount: e.participant_count || 0
      }));

      bindFilters();
      bindMobileFilter();
      applyFilters();
    })
    .catch(err => {
      console.error(err);
      allEvents = [];
      bindFilters();
      bindMobileFilter();
      applyFilters();
    });
  }

  function bindFilters() {
    document.getElementById('evtStatusFilter')?.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      document.querySelectorAll('#evtStatusFilter .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      statusFilter = btn.dataset.filter;
      currentPage = 1;
      applyFilters();
    });
    document.getElementById('evtSearch')?.addEventListener('input', () => { currentPage=1; applyFilters(); });
  }

  function applyFilters() {
    const kw = (document.getElementById('evtSearch')?.value||'').toLowerCase();
    dateStart = window.searchStartDate || '';
    dateEnd = window.searchEndDate || '';
    
    filtered = allEvents.map(e => ({ ...e, _status: getEvtStatus(e) }));
    if (statusFilter !== 'all') filtered = filtered.filter(e => e._status === statusFilter);
    if (kw) filtered = filtered.filter(e => e.title.toLowerCase().includes(kw));
    if (dateStart) filtered = filtered.filter(e => e.endDate >= dateStart);
    if (dateEnd) filtered = filtered.filter(e => e.startDate <= dateEnd);
    renderAll();
  }

  function renderAll() {
    renderTable();
    renderMobileCards();
    renderPagination();
    const ct = '총 ' + filtered.length + '건';
    const c1 = document.getElementById('evtListCount'); if (c1) c1.textContent = ct;
    const c2 = document.getElementById('evtListCountM'); if (c2) c2.textContent = ct;
  }

  function renderTable() {
    const tb = document.getElementById('evtTableBody');
    if (!tb) return;
    const start = (currentPage - 1) * PER_PAGE;
    const page = filtered.slice(start, start + PER_PAGE);
    
    if (!page.length) { 
      tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-muted);">등록된 이벤트가 없습니다.</td></tr>'; 
      return; 
    }
    
    const encTitle = encodeURIComponent(new URLSearchParams(location.search).get('title')||'RO1');
    tb.innerHTML = page.map((e, i) => {
      const ptcCnt = e.participantCount || 0;
      const cpnTxt = e.couponMethod === 'auto' ? '자동 발송' : '수동 발송';
      const createdStr = e.createdAt.substring(0, 16);
      
      const ahBtn = window._isEvtViewOnly 
        ? `<a href="event_detail.html?id=${e.id}&title=${encTitle}" class="btn btn-outline-secondary btn-sm">조회</a>`
        : `<a href="event_detail.html?id=${e.id}&title=${encTitle}" class="btn btn-secondary btn-sm">관리</a>`;
      
      return `<tr onclick="location.href='event_detail.html?id=${e.id}&title=${encTitle}'" style="cursor:pointer;">
        <td class="col-no">${start + i + 1}</td>
        <td><strong>${esc(e.title)}</strong></td>
        <td>${typeLabel(e.type)}</td>
        <td>${cpnTxt}</td>
        <td>${(e.startDate||'').replace('T',' ')} ~ ${(e.endDate||'').replace('T',' ')}</td>
        <td>${ptcCnt}명</td>
        <td>${createdStr}</td>
        <td>${esc(e.author||'-')}</td>
        <td>${statusBadge(e._status)}</td>
        <td class="col-action" onclick="event.stopPropagation()">${ahBtn}</td>
      </tr>`;
    }).join('');
  }

  function renderMobileCards() {
    const body = document.getElementById('evtMobileCardBody');
    if (!body) return;
    const start = (currentPage - 1) * PER_PAGE;
    const page = filtered.slice(start, start + PER_PAGE);
    if (!page.length) { body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">등록된 이벤트가 없습니다.</div>'; return; }
    
    const encTitle = encodeURIComponent(new URLSearchParams(location.search).get('title')||'RO1');
    body.innerHTML = page.map(e => {
      const ptcCnt = e.participantCount || 0;
      const stCls = e._status === 'running' ? 'sent' : e._status === 'upcoming' ? 'pending' : 'cancelled';
      const stTxt = e._status === 'running' ? '진행 중' : e._status === 'upcoming' ? '예정' : '종료';
      const createdStr = e.createdAt.substring(0, 16);
      
      return `<a href="event_detail.html?id=${e.id}&title=${encTitle}" class="msg-card-item" style="text-decoration:none;color:inherit;">
        <div class="msg-card-row"><span class="msg-card-channel">${esc(e.title)}</span><span class="msg-card-status ${stCls}">${stTxt}</span></div>
        <div class="msg-card-preview">${typeLabel(e.type)} · ${(e.startDate||'').replace('T',' ')} ~ ${(e.endDate||'').replace('T',' ')}</div>
        <div class="msg-card-row"><span class="msg-card-date">${createdStr} 등록</span><span class="msg-card-manage">참여자 ${ptcCnt}명</span></div>
      </a>`;
    }).join('');
  }

  function renderPagination() {
    const el = document.getElementById('evtPagination');
    const tp = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    if (currentPage > tp) currentPage = tp;
    const mobile = window.innerWidth <= 1100;
    const mv = mobile ? 5 : 10;
    let sp = Math.max(1, currentPage - Math.floor(mv/2));
    let ep = Math.min(tp, sp + mv - 1);
    if (ep - sp < mv - 1) sp = Math.max(1, ep - mv + 1);
    let h = `<button class="page-btn" ${currentPage===1?'disabled':''} onclick="evtGoPage(1)">«</button>`;
    h += `<button class="page-btn" ${currentPage===1?'disabled':''} onclick="evtGoPage(${currentPage-1})">‹</button>`;
    for (let i = sp; i <= ep; i++) h += `<button class="page-btn ${i===currentPage?'active':''}" onclick="evtGoPage(${i})">${i}</button>`;
    h += `<button class="page-btn" ${currentPage===tp?'disabled':''} onclick="evtGoPage(${currentPage+1})">›</button>`;
    h += `<button class="page-btn" ${currentPage===tp?'disabled':''} onclick="evtGoPage(${tp})">»</button>`;
    el.innerHTML = h;
  }

  window.evtGoPage = function(p) {
    const tp = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    if (p < 1 || p > tp) return;
    currentPage = p; renderAll();
  };

  // 모바일 필터
  function bindMobileFilter() {
    const ov = document.getElementById('evtFilterOverlay');
    document.getElementById('evtMobileFilterBtn')?.addEventListener('click', () => { ov.classList.add('show'); document.body.style.overflow = 'hidden'; });
    function close() { ov.classList.remove('show'); document.body.style.overflow = ''; }
    document.getElementById('evtFilterClose')?.addEventListener('click', close);
    ov?.addEventListener('click', e => { if (e.target === ov) close(); });

    document.getElementById('evtMStatusSw')?.addEventListener('click', e => {
      const b = e.target.closest('.msg-status-sw'); if (!b) return;
      document.querySelectorAll('#evtMStatusSw .msg-status-sw').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });

    document.getElementById('evtMFilterApply')?.addEventListener('click', () => {
      document.getElementById('evtSearch').value = document.getElementById('evtMSearch')?.value || '';
      statusFilter = document.querySelector('#evtMStatusSw .msg-status-sw.active')?.dataset.val || 'all';
      document.querySelectorAll('#evtStatusFilter .filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === statusFilter);
      });
      dateStart = document.getElementById('evtMDateStart')?.value || '';
      dateEnd = document.getElementById('evtMDateEnd')?.value || '';
      close();
      currentPage = 1;
      applyFilters();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
