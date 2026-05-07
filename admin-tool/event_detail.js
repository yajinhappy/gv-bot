/**
 * event_detail.js — 이벤트 상세 + 참여자 관리
 */
(function () {
  'use strict';
  const EVT_KEY = 'gv_events';
  const PTC_KEY = 'gv_participants';
  const PER_PAGE = 15;
  let evt = null, allPtc = [], filteredPtc = [], ptcPage = 1;

  function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  function getEvtStatus(e) {
    if (e.status === 'inactive') return 'inactive';
    const today = new Date().toISOString().slice(0,10);
    if (today < e.startDate) return 'upcoming';
    if (today > e.endDate) return 'ended';
    return 'running';
  }

  function ptcStatusBadge(s) {
    if (s==='발송 완료') return '<span class="status-badge connected">발송 완료</span>';
    if (s==='발송 실패') return '<span class="status-badge disconnected">발송 실패</span>';
    if (s==='삭제됨') return '<span class="status-badge" style="background:#F5F5F5;color:#71717A;">삭제됨</span>';
    return '<span class="status-badge" style="background:#EFF6FF;color:var(--primary-color);">대기</span>';
  }

  /* ─── 토스트 ─── */
  function showToast(msg, type) {
    type = type || 'info';
    const container = document.getElementById('toastContainer');
    if (!container) { alert(msg); return; }
    const el = document.createElement('div');
    el.className = 'toast-msg ' + type;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(function() { el.classList.add('out'); }, 2500);
    setTimeout(function() { el.remove(); }, 3000);
  }

  function init() {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const title = params.get('title') || 'RO1';
    const events = JSON.parse(localStorage.getItem(EVT_KEY)||'[]');
    evt = events.find(function(e) { return e.id === id; });
    if (!evt) { document.getElementById('evtDetailGrid').innerHTML = '<p>이벤트를 찾을 수 없습니다.</p>'; return; }
    allPtc = JSON.parse(localStorage.getItem(PTC_KEY)||'[]').filter(function(p) { return p.eventId === id; });

    document.getElementById('pageTitle').textContent = title + ' - ' + evt.title;
    document.getElementById('evtDetailTitle').textContent = evt.title;

    // 목록 버튼
    document.getElementById('evtBackBtn')?.addEventListener('click', function() {
      location.href = 'event_mgmt.html?title=' + encodeURIComponent(title);
    });

    // 수정 버튼
    document.getElementById('evtEditBtn')?.addEventListener('click', function() {
      location.href = 'event_write.html?edit=' + id + '&title=' + encodeURIComponent(title);
    });

    renderInfo();
    renderStock();
    bindParticipants();
    bindModals();
    applyPtcFilter();
  }

  /* ─── 상세 정보 2단 그리드 ─── */
  function renderInfo() {
    const st = getEvtStatus(evt);
    let stLabel;
    if (st === 'inactive') stLabel = '<span class="status-badge" style="background:#FEF2F2;color:#DC2626;">비활성</span>';
    else if (st === 'running') stLabel = '<span class="status-badge connected">진행 중</span>';
    else if (st === 'upcoming') stLabel = '<span class="status-badge" style="background:#EFF6FF;color:var(--primary-color);">예정</span>';
    else stLabel = '<span class="status-badge" style="background:#F5F5F5;color:#71717A;">종료</span>';

    const typeLabel = evt.type === 'text' ? '일반 이벤트 (텍스트)' : '이미지 인증 이벤트';
    const methodLabel = evt.couponMethod === 'auto' ? '자동 발송' : '수동 발송';
    const cpnTypeLabel = evt.cpnType === 'single' ? '단일 코드' : '개별 코드';
    const dailyLabel = evt.daily === 'on' ? 'ON (' + (evt.dailyStart||'09:00') + ' ~ ' + (evt.dailyEnd||'23:59') + ')' : 'OFF';

    // 1줄: 이벤트 유형 / 상태
    let rows = '';
    rows += row('이벤트 유형', typeLabel);
    rows += row('상태', stLabel);
    // 2줄: 채널 / 슬래시 커맨드
    rows += row('채널', esc(evt.channel));
    rows += row('슬래시 커맨드', '<code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">' + esc(evt.command) + '</code>');
    // 3줄: 기간 / 데일리 반복
    rows += row('기간', evt.startDate + ' ~ ' + evt.endDate);
    rows += row('데일리 반복', dailyLabel);
    // 4줄: 쿠폰 발송 방식 / 쿠폰 코드 유형
    rows += row('쿠폰 발송 방식', methodLabel);
    rows += row('쿠폰 코드 유형', cpnTypeLabel);
    // 5줄: 등록자 / 등록일
    rows += row('등록자', esc(evt.author||'-'));
    rows += row('등록일', evt.createdAt);
    // 6줄: 내용 (full-width)
    if (evt.desc) rows += rowFull('내용', esc(evt.desc));
    if (evt.memo) rows += rowFull('메모', esc(evt.memo));

    // 쿠폰 파일 정보 (개별 코드일 때 full-width)
    if (evt.cpnType === 'individual' && evt.cpnCodes && evt.cpnCodes.length > 0) {
      const fileHtml = '<div style="display:flex;align-items:center;gap:8px;">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>' +
        '<strong>coupon_data.xlsx</strong>' +
        '<span style="color:var(--text-muted);font-size:12px;">(' + evt.createdAt.slice(0,10).replace(/-/g, '.') + ' 업로드 · ' + evt.cpnCodes.length + '개 코드)</span>' +
        '</div>';
      rows += rowFull('쿠폰 파일', fileHtml);
    } else if (evt.cpnType === 'single') {
      rows += rowFull('쿠폰 코드', '<code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">' + esc(evt.cpnCode) + '</code>');
    }

    document.getElementById('evtDetailGrid').innerHTML = rows;

    // 참여 내용 헤더 조정
    const ch = document.getElementById('ptcContentHeader');
    if (ch) ch.textContent = evt.type === 'image' ? '인증 이미지' : '참여 내용';
  }

  function row(label, value) {
    return '<div class="detail-row"><div class="detail-label">' + label + '</div><div class="detail-value">' + value + '</div></div>';
  }
  function rowFull(label, value) {
    return '<div class="detail-row full-width"><div class="detail-label">' + label + '</div><div class="detail-value">' + value + '</div></div>';
  }

  /* ─── 재고 현황 ─── */
  function renderStock() {
    const card = document.getElementById('evtStockCard');
    const info = document.getElementById('evtStockInfo');
    if (evt.cpnStock === 'unlimited' && evt.cpnType === 'single') {
      card.style.display = '';
      info.innerHTML = '<div style="display:flex;align-items:center;gap:16px;"><strong style="font-size:20px;">∞</strong><span style="color:var(--text-muted);">무제한 · 발급 ' + (evt.cpnIssued||0) + '건</span></div>';
    } else {
      card.style.display = '';
      var total = evt.cpnType === 'individual' ? (evt.cpnCodes||[]).length : (evt.cpnStockLimit||0);
      var issued = evt.cpnIssued || 0;
      var remain = Math.max(0, total - issued);
      var pct = total > 0 ? (remain / total * 100) : 0;
      var barCls = pct < 10 ? 'low' : pct < 30 ? 'warn' : '';
      var alertTxt = pct > 0 && pct < 10 ? ' <span style="color:#DC2626;font-weight:600;font-size:13px;">⚠ 잔여 10% 미만</span>' : '';
      info.innerHTML = '<div style="margin-bottom:8px;font-size:14px;">잔여: <strong>' + remain + '</strong> / ' + total + '건 · 발급 ' + issued + '건' + alertTxt + '</div><div class="cpn-stock-bar"><div class="cpn-stock-bar-fill ' + barCls + '" style="width:' + pct + '%"></div></div>';
    }
  }

  // ─── 참여자 ───
  function bindParticipants() {
    document.getElementById('ptcStatusFilter')?.addEventListener('change', function() { ptcPage=1; applyPtcFilter(); });
    document.getElementById('ptcCheckAll')?.addEventListener('change', function(e) {
      document.querySelectorAll('.ptc-check').forEach(function(cb) { cb.checked = e.target.checked; });
      updateCouponBtn();
    });
    document.getElementById('ptcCouponSendBtn')?.addEventListener('click', openCouponModal);
  }

  function applyPtcFilter() {
    var sf = document.getElementById('ptcStatusFilter')?.value || 'all';
    filteredPtc = sf === 'all' ? allPtc.slice() : allPtc.filter(function(p) { return p.status === sf; });
    document.getElementById('ptcCount').textContent = '총 ' + filteredPtc.length + '건';
    ptcPage = 1;
    renderPtc();
  }

  function renderPtc() {
    var start = (ptcPage - 1) * PER_PAGE;
    var page = filteredPtc.slice(start, start + PER_PAGE);
    var tb = document.getElementById('ptcTableBody');
    if (!page.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">참여자가 없습니다.</td></tr>'; renderPtcPagination(); return; }
    tb.innerHTML = page.map(function(p, i) {
      var content;
      if (evt.type === 'image' && p.imageUrl) {
        content = '<img class="evt-thumb" src="' + p.imageUrl + '" alt="thumb" onclick="event.stopPropagation();evtShowImage(\'' + p.imageUrl + '\')">';
      } else {
        content = p.content ? esc(p.content) : '-';
      }
      var disabled = p.status !== '대기' ? 'disabled' : '';

      var cpnDisp = '<span style="color:var(--text-muted);font-size:12px;">-</span>';
      if (p.status === '발송 완료') {
        var fullCode = evt.cpnType === 'single' ? evt.cpnCode : (p.couponCode || 'RO1-C' + p.id.replace('p','') + 'XYZ');
        var maskedCode = fullCode.slice(0, 3) + '*'.repeat(Math.max(3, fullCode.length - 3));
        cpnDisp = '<div style="display:flex;align-items:center;gap:4px;">' +
          '<code class="cpn-code" data-full="' + esc(fullCode) + '" data-masked="' + esc(maskedCode) + '" style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px;">' + esc(maskedCode) + '</code>' +
          '<button class="btn btn-secondary" style="padding:2px 4px;font-size:10px;height:auto;" onclick="toggleCpnMask(this)">조회</button>' +
          '</div>';
      }

      return '<tr>' +
        '<td><input type="checkbox" class="ptc-check" data-id="' + p.id + '" onchange="updateCouponBtn()" ' + disabled + '></td>' +
        '<td class="col-no">' + (start + i + 1) + '</td>' +
        '<td><strong>' + esc(p.userName) + '</strong><br><span style="font-size:11px;color:var(--text-muted);">' + esc(p.userId) + '</span></td>' +
        '<td>' + content + '</td>' +
        '<td>' + cpnDisp + '</td>' +
        '<td>' + p.joinedAt + '</td>' +
        '<td>' + ptcStatusBadge(p.status) + '</td>' +
        '</tr>';
    }).join('');

    // 모바일 카드
    var mBody = document.getElementById('ptcMobileCardBody');
    if (mBody) {
      mBody.innerHTML = page.map(function(p) {
        var stCls = p.status === '발송 완료' ? 'sent' : p.status === '삭제됨' ? 'cancelled' : 'pending';
        return '<div class="msg-card-item">' +
          '<div class="msg-card-row"><span class="msg-card-channel">' + esc(p.userName) + '</span><span class="msg-card-status ' + stCls + '">' + p.status + '</span></div>' +
          '<div class="msg-card-preview">' + (evt.type==='image'&&p.imageUrl?'[이미지 첨부]':(p.content||'-')) + '</div>' +
          '<div class="msg-card-row"><span class="msg-card-date">' + p.joinedAt + '</span></div>' +
          '</div>';
      }).join('');
    }
    renderPtcPagination();
  }

  function renderPtcPagination() {
    var el = document.getElementById('ptcPagination');
    var tp = Math.max(1, Math.ceil(filteredPtc.length / PER_PAGE));
    if (ptcPage > tp) ptcPage = tp;
    var h = '<button class="page-btn" ' + (ptcPage===1?'disabled':'') + ' onclick="ptcGoPage(1)">«</button>';
    h += '<button class="page-btn" ' + (ptcPage===1?'disabled':'') + ' onclick="ptcGoPage(' + (ptcPage-1) + ')">‹</button>';
    var mv = 10, sp = Math.max(1,ptcPage-Math.floor(mv/2)), ep = Math.min(tp,sp+mv-1);
    if(ep-sp<mv-1) sp=Math.max(1,ep-mv+1);
    for(var i=sp;i<=ep;i++) h+='<button class="page-btn ' + (i===ptcPage?'active':'') + '" onclick="ptcGoPage(' + i + ')">' + i + '</button>';
    h += '<button class="page-btn" ' + (ptcPage===tp?'disabled':'') + ' onclick="ptcGoPage(' + (ptcPage+1) + ')">›</button>';
    h += '<button class="page-btn" ' + (ptcPage===tp?'disabled':'') + ' onclick="ptcGoPage(' + tp + ')">»</button>';
    el.innerHTML = h;
  }

  window.ptcGoPage = function(p) { var tp=Math.max(1,Math.ceil(filteredPtc.length/PER_PAGE)); if(p<1||p>tp)return; ptcPage=p; renderPtc(); };
  window.updateCouponBtn = function() { document.getElementById('ptcCouponSendBtn').disabled = !document.querySelectorAll('.ptc-check:checked').length; };

  window.toggleCpnMask = function(btn) {
    var codeEl = btn.previousElementSibling;
    var isMasked = codeEl.textContent === codeEl.dataset.masked;
    if (isMasked) { codeEl.textContent = codeEl.dataset.full; btn.textContent = '숨김'; }
    else { codeEl.textContent = codeEl.dataset.masked; btn.textContent = '조회'; }
  };

  // ─── 모달 ───
  function bindModals() {
    bindModal('evtCouponModal','evtCouponClose');
    document.getElementById('evtCouponCancelBtn')?.addEventListener('click', function() { document.getElementById('evtCouponModal').style.display='none'; });
    document.getElementById('evtCouponSendSubmit')?.addEventListener('click', submitCouponSend);
    document.getElementById('evtImageOverlay')?.addEventListener('click', function() { document.getElementById('evtImageOverlay').classList.remove('show'); });
  }

  function bindModal(oid, cid) {
    var ov = document.getElementById(oid);
    document.getElementById(cid)?.addEventListener('click', function() { ov.style.display='none'; });
    ov?.addEventListener('click', function(e) { if(e.target===ov) ov.style.display='none'; });
  }

  window.evtShowImage = function(url) {
    document.getElementById('evtImageFull').src = url;
    document.getElementById('evtImageOverlay').classList.add('show');
  };

  function openCouponModal() {
    var checked = Array.from(document.querySelectorAll('.ptc-check:checked'));
    if (!checked.length) return;
    var ids = checked.map(function(cb) { return cb.dataset.id; });
    var users = ids.map(function(id) { return allPtc.find(function(p) { return p.id === id; }); }).filter(Boolean);
    var body = document.getElementById('evtCouponBody');

    if (evt.cpnType === 'single') {
      body.innerHTML = '<p style="margin-bottom:12px;font-size:14px;">총 <strong>' + users.length + '명</strong>에게 쿠폰 코드 <code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">' + esc(evt.cpnCode) + '</code>를 DM으로 발송합니다.</p>' +
        '<div style="max-height:250px;overflow-y:auto;">' + users.map(function(u) { return '<div class="evt-coupon-row"><span class="evt-coupon-user">' + esc(u.userName) + '</span><span style="color:var(--text-muted);font-size:13px;">' + esc(evt.cpnCode) + '</span></div>'; }).join('') + '</div>';
    } else {
      body.innerHTML = '<p style="margin-bottom:12px;font-size:14px;">총 <strong>' + users.length + '명</strong>에게 개별 쿠폰 코드를 DM으로 발송합니다.</p>' +
        '<div style="max-height:300px;overflow-y:auto;">' + users.map(function(u) { return '<div class="evt-coupon-row"><span class="evt-coupon-user">' + esc(u.userName) + '</span><input class="evt-coupon-input" data-ptc-id="' + u.id + '" placeholder="쿠폰 코드 입력"></div>'; }).join('') + '</div>';
    }
    document.getElementById('evtCouponModal').style.display = 'flex';
  }

  function submitCouponSend() {
    var allP = JSON.parse(localStorage.getItem(PTC_KEY)||'[]');
    var count = 0;
    var sendTargets = [];

    if (evt.cpnType === 'single') {
      document.querySelectorAll('.ptc-check:checked').forEach(function(cb) {
        var p = allP.find(function(x) { return x.id === cb.dataset.id; });
        if (p) {
          p.status = '발송 완료';
          p.couponCode = evt.cpnCode;
          sendTargets.push({ userId: p.userId, userName: p.userName, couponCode: evt.cpnCode });
          count++;
        }
      });
    } else {
      document.querySelectorAll('.evt-coupon-input').forEach(function(inp) {
        if (!inp.value.trim()) return;
        var p = allP.find(function(x) { return x.id === inp.dataset.ptcId; });
        if (p) {
          p.status = '발송 완료';
          p.couponCode = inp.value.trim();
          sendTargets.push({ userId: p.userId, userName: p.userName, couponCode: inp.value.trim() });
          count++;
        }
      });
    }

    if (count === 0) { showToast('발송 대상이 없습니다.', 'error'); return; }

    // 발급 수 업데이트 (localStorage)
    var evts = JSON.parse(localStorage.getItem(EVT_KEY)||'[]');
    var e = evts.find(function(x) { return x.id === evt.id; });
    if (e) { e.cpnIssued = (e.cpnIssued||0) + count; evt.cpnIssued = e.cpnIssued; }
    localStorage.setItem(EVT_KEY, JSON.stringify(evts));
    localStorage.setItem(PTC_KEY, JSON.stringify(allP));
    allPtc = allP.filter(function(pp) { return pp.eventId === evt.id; });

    // 봇 서버에 DM 발송 요청
    var API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3001' : '';
    fetch(API_BASE + '/api/events/send-coupon-dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventTitle: evt.title,
        targets: sendTargets
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        showToast(count + '명에게 쿠폰 DM 발송 완료!', 'success');
      } else {
        showToast(count + '명 처리 완료 (DM 발송 실패: ' + (data.error||'봇 연결 확인') + ')', 'error');
      }
    })
    .catch(function() {
      showToast(count + '명 쿠폰 상태 반영 완료 (봇 서버 연결 실패 — 나중에 재발송 가능)', 'error');
    });

    document.getElementById('evtCouponModal').style.display = 'none';
    renderStock();
    applyPtcFilter();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
