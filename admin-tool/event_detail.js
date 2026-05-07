/**
 * event_detail.js — 이벤트 상세 + 참여자 관리 (API 연동)
 */
(function () {
  'use strict';
  const PER_PAGE = 15;
  let evt = null, allPtc = [], filteredPtc = [], ptcPage = 1;
  let evtId = null, pageTitle = '';

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function nowKSTIso() {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
  }

  function getEvtStatus(e) {
    if (e.status === 'inactive') return 'inactive';
    const now = nowKSTIso();
    if (now < e.start_date) return 'upcoming';
    if (now > e.end_date) return 'ended';
    return 'running';
  }

  function ptcStatusBadge(s) {
    if (s === '발송 완료') return '<span class="status-badge connected">발송 완료</span>';
    if (s === '발송 실패') return '<span class="status-badge disconnected">발송 실패</span>';
    if (s === '삭제됨') return '<span class="status-badge" style="background:#F5F5F5;color:#71717A;">삭제됨</span>';
    return '<span class="status-badge" style="background:#EFF6FF;color:var(--primary-color);">대기</span>';
  }

  function showToast(msg, type) {
    type = type || 'info';
    const container = document.getElementById('toastContainer');
    if (!container) { alert(msg); return; }
    const el = document.createElement('div');
    el.className = 'toast-msg ' + type;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 2500);
    setTimeout(function () { el.remove(); }, 3000);
  }

  function apiBase() {
    return window.API_CONFIG ? window.API_CONFIG.BASE_URL : '/api';
  }
  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': window.API_CONFIG ? window.API_CONFIG.API_KEY : '',
      'Authorization': 'Bearer ' + (localStorage.getItem('gv_auth_token') || '')
    };
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    evtId = params.get('id');
    pageTitle = params.get('title') || 'RO1';

    if (!evtId) {
      document.getElementById('evtDetailGrid').innerHTML = '<p>잘못된 접근입니다.</p>';
      return;
    }

    try {
      const [evtRes, ptcRes] = await Promise.all([
        fetch(apiBase() + '/events/' + evtId, { headers: authHeaders() }).then(r => r.json()),
        fetch(apiBase() + '/events/' + evtId + '/participants', { headers: authHeaders() }).then(r => r.json())
      ]);

      if (!evtRes.success || !evtRes.event) {
        document.getElementById('evtDetailGrid').innerHTML = '<p>이벤트를 찾을 수 없습니다.</p>';
        return;
      }

      evt = evtRes.event;
      allPtc = ptcRes.success ? ptcRes.participants : [];

      document.getElementById('pageTitle').textContent = pageTitle + ' - ' + evt.title;
      document.getElementById('evtDetailTitle').textContent = evt.title;

      document.getElementById('evtBackBtn')?.addEventListener('click', function () {
        location.href = 'event_mgmt.html?title=' + encodeURIComponent(pageTitle);
      });
      document.getElementById('evtEditBtn')?.addEventListener('click', function () {
        location.href = 'event_write.html?edit=' + evtId + '&title=' + encodeURIComponent(pageTitle);
      });

      renderInfo();
      renderStock();
      bindParticipants();
      bindModals();
      applyPtcFilter();

    } catch (err) {
      console.error('이벤트 로드 실패:', err);
      document.getElementById('evtDetailGrid').innerHTML = '<p>이벤트 정보를 불러오지 못했습니다.</p>';
    }
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
    const methodLabel = evt.coupon_method === 'auto' ? '자동 발송' : '수동 발송';
    const cpnTypeLabel = evt.cpn_type === 'single' ? '단일 코드' : '개별 코드';
    const dailyLabel = evt.daily === 'on'
      ? 'ON (' + (evt.daily_start || '09:00') + ' ~ ' + (evt.daily_end || '23:59') + ')'
      : 'OFF';

    let rows = '';
    rows += row('이벤트 유형', typeLabel);
    rows += row('상태', stLabel);
    rows += row('채널', esc(evt.channel_id || '-'));
    rows += row('슬래시 커맨드', '<code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">' + esc(evt.command_name || '-') + '</code>');
    rows += row('기간', (evt.start_date || '').replace('T', ' ') + ' ~ ' + (evt.end_date || '').replace('T', ' '));
    rows += row('데일리 반복', dailyLabel);
    rows += row('쿠폰 발송 방식', methodLabel);
    rows += row('쿠폰 코드 유형', cpnTypeLabel);
    rows += row('등록자', esc(evt.author || '-'));
    rows += row('등록일', evt.created_at || '-');
    if (evt.description) rows += rowFull('내용', esc(evt.description));
    if (evt.memo) rows += rowFull('메모', esc(evt.memo));
    if (evt.cpn_type === 'single' && evt.cpn_code) {
      rows += rowFull('쿠폰 코드', '<code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">' + esc(evt.cpn_code) + '</code>');
    }

    document.getElementById('evtDetailGrid').innerHTML = rows;
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
    const issued = evt.cpn_issued || 0;
    card.style.display = '';
    if (evt.cpn_stock === 'unlimited' && evt.cpn_type === 'single') {
      info.innerHTML = '<div style="display:flex;align-items:center;gap:16px;"><strong style="font-size:20px;">∞</strong><span style="color:var(--text-muted);">무제한 · 발급 ' + issued + '건</span></div>';
    } else {
      const total = evt.cpn_stock_limit || 0;
      const remain = Math.max(0, total - issued);
      const pct = total > 0 ? (remain / total * 100) : 0;
      const barCls = pct < 10 ? 'low' : pct < 30 ? 'warn' : '';
      const alertTxt = pct > 0 && pct < 10 ? ' <span style="color:#DC2626;font-weight:600;font-size:13px;">⚠ 잔여 10% 미만</span>' : '';
      info.innerHTML = '<div style="margin-bottom:8px;font-size:14px;">잔여: <strong>' + remain + '</strong> / ' + total + '건 · 발급 ' + issued + '건' + alertTxt + '</div><div class="cpn-stock-bar"><div class="cpn-stock-bar-fill ' + barCls + '" style="width:' + pct + '%"></div></div>';
    }
  }

  /* ─── 참여자 ─── */
  function bindParticipants() {
    document.getElementById('ptcStatusFilter')?.addEventListener('change', function () { ptcPage = 1; applyPtcFilter(); });
    document.getElementById('ptcCheckAll')?.addEventListener('change', function (e) {
      document.querySelectorAll('.ptc-check').forEach(function (cb) { cb.checked = e.target.checked; });
      updateCouponBtn();
    });
    document.getElementById('ptcCouponSendBtn')?.addEventListener('click', openCouponModal);
  }

  function applyPtcFilter() {
    const sf = document.getElementById('ptcStatusFilter')?.value || 'all';
    filteredPtc = sf === 'all' ? allPtc.slice() : allPtc.filter(function (p) { return p.status === sf; });
    document.getElementById('ptcCount').textContent = '총 ' + filteredPtc.length + '건';
    ptcPage = 1;
    renderPtc();
  }

  function renderPtc() {
    const start = (ptcPage - 1) * PER_PAGE;
    const page = filteredPtc.slice(start, start + PER_PAGE);
    const tb = document.getElementById('ptcTableBody');
    if (!page.length) {
      tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">참여자가 없습니다.</td></tr>';
      renderPtcPagination();
      return;
    }
    tb.innerHTML = page.map(function (p, i) {
      let content;
      if (evt.type === 'image' && p.image_url) {
        content = '<img class="evt-thumb" src="' + p.image_url + '" alt="thumb" onclick="event.stopPropagation();evtShowImage(\'' + p.image_url + '\')">';
      } else {
        content = p.content ? esc(p.content) : '-';
      }
      const disabled = p.status !== '대기' ? 'disabled' : '';

      let cpnDisp = '<span style="color:var(--text-muted);font-size:12px;">-</span>';
      if (p.status === '발송 완료') {
        const fullCode = p.coupon_code || (evt.cpn_type === 'single' ? evt.cpn_code : '-');
        const maskedCode = fullCode && fullCode.length > 3 ? fullCode.slice(0, 3) + '*'.repeat(fullCode.length - 3) : fullCode;
        cpnDisp = '<div style="display:flex;align-items:center;gap:4px;">' +
          '<code class="cpn-code" data-full="' + esc(fullCode) + '" data-masked="' + esc(maskedCode) + '" style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px;">' + esc(maskedCode) + '</code>' +
          '<button class="btn btn-secondary" style="padding:2px 4px;font-size:10px;height:auto;" onclick="toggleCpnMask(this)">조회</button>' +
          '</div>';
      }

      return '<tr>' +
        '<td><input type="checkbox" class="ptc-check" data-id="' + p.id + '" onchange="updateCouponBtn()" ' + disabled + '></td>' +
        '<td class="col-no">' + (start + i + 1) + '</td>' +
        '<td><strong>' + esc(p.user_name) + '</strong><br><span style="font-size:11px;color:var(--text-muted);">' + esc(p.user_id) + '</span></td>' +
        '<td>' + content + '</td>' +
        '<td>' + cpnDisp + '</td>' +
        '<td>' + (p.joined_at || '-') + '</td>' +
        '<td>' + ptcStatusBadge(p.status) + '</td>' +
        '</tr>';
    }).join('');

    const mBody = document.getElementById('ptcMobileCardBody');
    if (mBody) {
      mBody.innerHTML = page.map(function (p) {
        const stCls = p.status === '발송 완료' ? 'sent' : p.status === '삭제됨' ? 'cancelled' : 'pending';
        return '<div class="msg-card-item">' +
          '<div class="msg-card-row"><span class="msg-card-channel">' + esc(p.user_name) + '</span><span class="msg-card-status ' + stCls + '">' + p.status + '</span></div>' +
          '<div class="msg-card-preview">' + (evt.type === 'image' && p.image_url ? '[이미지 첨부]' : (p.content || '-')) + '</div>' +
          '<div class="msg-card-row"><span class="msg-card-date">' + (p.joined_at || '-') + '</span></div>' +
          '</div>';
      }).join('');
    }
    renderPtcPagination();
  }

  function renderPtcPagination() {
    const el = document.getElementById('ptcPagination');
    const tp = Math.max(1, Math.ceil(filteredPtc.length / PER_PAGE));
    if (ptcPage > tp) ptcPage = tp;
    let h = '<button class="page-btn" ' + (ptcPage === 1 ? 'disabled' : '') + ' onclick="ptcGoPage(1)">«</button>';
    h += '<button class="page-btn" ' + (ptcPage === 1 ? 'disabled' : '') + ' onclick="ptcGoPage(' + (ptcPage - 1) + ')">‹</button>';
    const mv = 10, sp = Math.max(1, ptcPage - Math.floor(mv / 2));
    let ep = Math.min(tp, sp + mv - 1);
    const spAdj = Math.max(1, ep - mv + 1);
    for (let i = spAdj; i <= ep; i++) h += '<button class="page-btn ' + (i === ptcPage ? 'active' : '') + '" onclick="ptcGoPage(' + i + ')">' + i + '</button>';
    h += '<button class="page-btn" ' + (ptcPage === tp ? 'disabled' : '') + ' onclick="ptcGoPage(' + (ptcPage + 1) + ')">›</button>';
    h += '<button class="page-btn" ' + (ptcPage === tp ? 'disabled' : '') + ' onclick="ptcGoPage(' + tp + ')">»</button>';
    el.innerHTML = h;
  }

  window.ptcGoPage = function (p) {
    const tp = Math.max(1, Math.ceil(filteredPtc.length / PER_PAGE));
    if (p < 1 || p > tp) return;
    ptcPage = p;
    renderPtc();
  };
  window.updateCouponBtn = function () {
    document.getElementById('ptcCouponSendBtn').disabled = !document.querySelectorAll('.ptc-check:checked').length;
  };
  window.toggleCpnMask = function (btn) {
    const codeEl = btn.previousElementSibling;
    const isMasked = codeEl.textContent === codeEl.dataset.masked;
    if (isMasked) { codeEl.textContent = codeEl.dataset.full; btn.textContent = '숨김'; }
    else { codeEl.textContent = codeEl.dataset.masked; btn.textContent = '조회'; }
  };

  /* ─── 모달 ─── */
  function bindModals() {
    bindModal('evtCouponModal', 'evtCouponClose');
    document.getElementById('evtCouponCancelBtn')?.addEventListener('click', function () { document.getElementById('evtCouponModal').style.display = 'none'; });
    document.getElementById('evtCouponSendSubmit')?.addEventListener('click', submitCouponSend);
    document.getElementById('evtImageOverlay')?.addEventListener('click', function () { document.getElementById('evtImageOverlay').classList.remove('show'); });
  }

  function bindModal(oid, cid) {
    const ov = document.getElementById(oid);
    document.getElementById(cid)?.addEventListener('click', function () { ov.style.display = 'none'; });
    ov?.addEventListener('click', function (e) { if (e.target === ov) ov.style.display = 'none'; });
  }

  window.evtShowImage = function (url) {
    document.getElementById('evtImageFull').src = url;
    document.getElementById('evtImageOverlay').classList.add('show');
  };

  function openCouponModal() {
    const checked = Array.from(document.querySelectorAll('.ptc-check:checked'));
    if (!checked.length) return;
    const ids = checked.map(function (cb) { return parseInt(cb.dataset.id); });
    const users = ids.map(function (id) { return allPtc.find(function (p) { return p.id === id; }); }).filter(Boolean);
    const body = document.getElementById('evtCouponBody');

    if (evt.cpn_type === 'single') {
      body.innerHTML = '<p style="margin-bottom:12px;font-size:14px;">총 <strong>' + users.length + '명</strong>에게 쿠폰 코드 <code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">' + esc(evt.cpn_code) + '</code>를 DM으로 발송합니다.</p>' +
        '<div style="max-height:250px;overflow-y:auto;">' + users.map(function (u) {
          return '<div class="evt-coupon-row"><span class="evt-coupon-user">' + esc(u.user_name) + '</span><span style="color:var(--text-muted);font-size:13px;">' + esc(evt.cpn_code) + '</span></div>';
        }).join('') + '</div>';
    } else {
      body.innerHTML = '<p style="margin-bottom:12px;font-size:14px;">총 <strong>' + users.length + '명</strong>에게 개별 쿠폰 코드를 DM으로 발송합니다.</p>' +
        '<div style="max-height:300px;overflow-y:auto;">' + users.map(function (u) {
          return '<div class="evt-coupon-row"><span class="evt-coupon-user">' + esc(u.user_name) + '</span><input class="evt-coupon-input" data-ptc-id="' + u.id + '" placeholder="쿠폰 코드 입력"></div>';
        }).join('') + '</div>';
    }
    document.getElementById('evtCouponModal').style.display = 'flex';
  }

  async function submitCouponSend() {
    const ptcIds = [];
    const couponCodes = [];
    const sendTargets = [];

    if (evt.cpn_type === 'single') {
      document.querySelectorAll('.ptc-check:checked').forEach(function (cb) {
        const p = allPtc.find(function (x) { return x.id === parseInt(cb.dataset.id); });
        if (p) {
          ptcIds.push(p.id);
          couponCodes.push(evt.cpn_code);
          sendTargets.push({ userId: p.user_id, userName: p.user_name, couponCode: evt.cpn_code });
        }
      });
    } else {
      document.querySelectorAll('.evt-coupon-input').forEach(function (inp) {
        if (!inp.value.trim()) return;
        const p = allPtc.find(function (x) { return x.id === parseInt(inp.dataset.ptcId); });
        if (p) {
          ptcIds.push(p.id);
          couponCodes.push(inp.value.trim());
          sendTargets.push({ userId: p.user_id, userName: p.user_name, couponCode: inp.value.trim() });
        }
      });
    }

    if (!ptcIds.length) { showToast('발송 대상이 없습니다.', 'error'); return; }

    try {
      // DM 발송
      const dmRes = await fetch(apiBase() + '/events/send-coupon-dm', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ eventTitle: evt.title, targets: sendTargets })
      }).then(r => r.json());

      // 참여자 상태 업데이트
      await fetch(apiBase() + '/events/' + evtId + '/participants/status', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ ptcIds, status: '발송 완료', couponCodes })
      });

      // 로컬 데이터 갱신
      ptcIds.forEach(function (id, i) {
        const p = allPtc.find(function (x) { return x.id === id; });
        if (p) { p.status = '발송 완료'; p.coupon_code = couponCodes[i]; }
      });
      evt.cpn_issued = (evt.cpn_issued || 0) + ptcIds.length;

      if (dmRes.success) {
        showToast(ptcIds.length + '명에게 쿠폰 DM 발송 완료!', 'success');
      } else {
        showToast(ptcIds.length + '명 처리 완료 (DM: ' + (dmRes.error || '봇 연결 확인') + ')', 'error');
      }
    } catch (err) {
      showToast('처리 중 오류가 발생했습니다.', 'error');
      console.error(err);
    }

    document.getElementById('evtCouponModal').style.display = 'none';
    renderStock();
    applyPtcFilter();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
