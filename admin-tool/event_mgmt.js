/**
 * event_mgmt.js — 이벤트 목록 (테이블 리스트)
 */
(function () {
  'use strict';
  const EVT_KEY = 'gv_events';
  const PTC_KEY = 'gv_participants';
  const PER_PAGE = 15;
  let allEvents = [], filtered = [], allPtc = [];
  let currentPage = 1, statusFilter = 'all', dateStart = '', dateEnd = '';

  function S(n) { return String(n).padStart(2,'0'); }
  function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  function getEvtStatus(e) {
    const today = new Date().toISOString().slice(0,10);
    if (today < e.startDate) return 'upcoming';
    if (today > e.endDate) return 'ended';
    return 'running';
  }
  function statusBadge(s) {
    if (s==='running') return '<span class="status-badge connected">진행 중</span>';
    if (s==='upcoming') return '<span class="status-badge" style="background:#EFF6FF;color:var(--primary-color);">예정</span>';
    return '<span class="status-badge" style="background:#F5F5F5;color:#71717A;">종료</span>';
  }
  function typeLabel(t) { return t === 'text' ? '일반 이벤트' : '이미지 인증'; }

  function seedIfEmpty() {
    if (JSON.parse(localStorage.getItem(EVT_KEY)||'[]').length > 0) return;
    const events = [
      { id:'d1',type:'text',title:'5월 출석체크',desc:'매일 출석체크!',startDate:'2026-05-01',endDate:'2026-05-31',channel:'#이벤트-참여',command:'/출석체크완료',daily:'on',dailyStart:'09:00',dailyEnd:'23:59',couponMethod:'auto',cpnType:'single',cpnCode:'GRAV-MAY-2026',cpnCodes:[],cpnStock:'unlimited',cpnStockLimit:0,cpnIssued:42,memo:'',author:'admin',createdAt:'2026-05-01 09:00:00'},
      { id:'d2',type:'image',title:'스크린샷 인증 이벤트',desc:'게임 플레이 스크린샷 인증!',startDate:'2026-05-05',endDate:'2026-05-20',channel:'#스크린샷-인증',command:'/스크린샷인증',daily:'off',dailyStart:'',dailyEnd:'',couponMethod:'manual',cpnType:'individual',cpnCode:'',cpnCodes:['RO1-A001','RO1-A002','RO1-A003','RO1-A004','RO1-A005','RO1-A006','RO1-A007','RO1-A008','RO1-A009','RO1-A010'],cpnStock:'limited',cpnStockLimit:10,cpnIssued:3,memo:'이미지 확인 후 발송',author:'admin',createdAt:'2026-05-04 14:00:00'},
      { id:'d3',type:'text',title:'런칭 기념 이벤트',desc:'런칭 축하!',startDate:'2026-04-15',endDate:'2026-04-30',channel:'#이벤트',command:'/런칭축하',daily:'off',dailyStart:'',dailyEnd:'',couponMethod:'auto',cpnType:'single',cpnCode:'LAUNCH-2026',cpnCodes:[],cpnStock:'limited',cpnStockLimit:100,cpnIssued:100,memo:'',author:'operator1',createdAt:'2026-04-14 10:00:00'},
    ];
    localStorage.setItem(EVT_KEY, JSON.stringify(events));

    const ptcs = [
      { id:'p1',eventId:'d1',eventTitle:'5월 출석체크',userId:'user#1234',userName:'PlayerOne',content:'출석 완료!',imageUrl:'',joinedAt:'2026-05-06 10:23:45',status:'발송 완료'},
      { id:'p2',eventId:'d1',eventTitle:'5월 출석체크',userId:'user#5678',userName:'GamerKR',content:'출석!',imageUrl:'',joinedAt:'2026-05-06 11:05:12',status:'대기'},
      { id:'p3',eventId:'d2',eventTitle:'스크린샷 인증 이벤트',userId:'user#9012',userName:'ScreenCapPro',content:'',imageUrl:'https://placehold.co/400x300/2563eb/white?text=Screenshot',joinedAt:'2026-05-06 15:30:00',status:'대기'},
      { id:'p4',eventId:'d2',eventTitle:'스크린샷 인증 이벤트',userId:'user#3456',userName:'ArtFan',content:'',imageUrl:'https://placehold.co/400x300/16a34a/white?text=Game+Play',joinedAt:'2026-05-06 16:10:33',status:'대기'},
      { id:'p5',eventId:'d3',eventTitle:'런칭 기념 이벤트',userId:'user#7890',userName:'EarlyBird',content:'런칭 축하!',imageUrl:'',joinedAt:'2026-04-15 12:00:00',status:'발송 완료'},
    ];
    localStorage.setItem(PTC_KEY, JSON.stringify(ptcs));
  }

  function init() {
    seedIfEmpty();
    allEvents = JSON.parse(localStorage.getItem(EVT_KEY)||'[]');
    allPtc = JSON.parse(localStorage.getItem(PTC_KEY)||'[]');
    const title = new URLSearchParams(location.search).get('title') || 'RO1';
    document.getElementById('pageTitle').textContent = title + ' - 이벤트 관리';

    // 등록 버튼
    const enc = encodeURIComponent(title);
    document.getElementById('evtNewBtn')?.setAttribute('href', 'event_write.html?title=' + enc);
    const fab = document.getElementById('evtNewFab');
    if (fab) fab.setAttribute('href', 'event_write.html?title=' + enc);

    bindFilters();
    bindMobileFilter();
    applyFilters();
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
      const ptcCnt = allPtc.filter(p => p.eventId === e.id && p.status !== '삭제됨').length;
      const cpnTxt = e.couponMethod === 'auto' ? '자동 발송' : '수동 발송';
      const createdStr = e.createdAt.substring(0, 16);
      
      return `<tr onclick="location.href='event_detail.html?id=${e.id}&title=${encTitle}'" style="cursor:pointer;">
        <td class="col-no">${start + i + 1}</td>
        <td><strong>${esc(e.title)}</strong></td>
        <td>${typeLabel(e.type)}</td>
        <td>${cpnTxt}</td>
        <td>${e.startDate} ~ ${e.endDate}</td>
        <td>${ptcCnt}명</td>
        <td>${createdStr}</td>
        <td>${esc(e.author||'-')}</td>
        <td>${statusBadge(e._status)}</td>
        <td class="col-action" onclick="event.stopPropagation()"><a href="event_detail.html?id=${e.id}&title=${encTitle}" class="btn btn-secondary btn-sm">관리</a></td>
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
      const ptcCnt = allPtc.filter(p => p.eventId === e.id && p.status !== '삭제됨').length;
      const stCls = e._status === 'running' ? 'sent' : e._status === 'upcoming' ? 'pending' : 'cancelled';
      const stTxt = e._status === 'running' ? '진행 중' : e._status === 'upcoming' ? '예정' : '종료';
      const createdStr = e.createdAt.substring(0, 16);
      
      return `<a href="event_detail.html?id=${e.id}&title=${encTitle}" class="msg-card-item" style="text-decoration:none;color:inherit;">
        <div class="msg-card-row"><span class="msg-card-channel">${esc(e.title)}</span><span class="msg-card-status ${stCls}">${stTxt}</span></div>
        <div class="msg-card-preview">${typeLabel(e.type)} · ${e.startDate} ~ ${e.endDate}</div>
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
