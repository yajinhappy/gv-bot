/**
 * 쿠폰 코드 관리 (6-8) — 프론트엔드 로직
 * localStorage 기반 데모 데이터로 동작
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'gv_coupons';
  const PER_PAGE = 15;
  let allCoupons = [];
  let filtered = [];
  let currentPage = 1;
  let uploadedCodes = [];

  // ─── 유틸 ───
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function now() { const d = new Date(); return d.getFullYear() + '-' + S(d.getMonth()+1) + '-' + S(d.getDate()) + ' ' + S(d.getHours()) + ':' + S(d.getMinutes()); }
  function S(n) { return String(n).padStart(2, '0'); }
  function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
  function save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

  // ─── 데모 시드 ───
  function seedIfEmpty() {
    if (load().length > 0) return;
    const demos = [
      { id: uid(), name: '5월 출석체크 쿠폰', type: 'single', code: 'GRAVITY-MAY-2026', codes: [], stock: 'unlimited', stockLimit: 0, issued: 42, event: '', memo: '5월 출석체크 이벤트용', status: 'active', createdAt: '2026-05-01 10:00' },
      { id: uid(), name: '스크린샷 인증 보상', type: 'individual', code: '', codes: ['RO1-A001','RO1-A002','RO1-A003','RO1-A004','RO1-A005','RO1-A006','RO1-A007','RO1-A008','RO1-A009','RO1-A010'], stock: 'limited', stockLimit: 10, issued: 3, event: '', memo: '이미지 인증 이벤트', status: 'active', createdAt: '2026-05-03 14:30' },
      { id: uid(), name: '런칭 기념 쿠폰', type: 'single', code: 'LAUNCH-2026', codes: [], stock: 'limited', stockLimit: 100, issued: 100, event: '', memo: '', status: 'exhausted', createdAt: '2026-04-20 09:00' },
    ];
    save(demos);
  }

  // ─── 초기화 ───
  function init() {
    seedIfEmpty();
    allCoupons = load();
    const title = new URLSearchParams(location.search).get('title') || 'RO1';
    const breadcrumbTitle = document.getElementById('breadcrumbTitle');
    if (breadcrumbTitle) breadcrumbTitle.textContent = title;
    const pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = title + ' - 쿠폰 코드 관리';

    bindTabs();
    bindForm();
    bindFilters();
    bindMobileFilter();
    bindModals();
    applyFilters();
  }

  // ─── 탭 ───
  function bindTabs() {
    document.querySelectorAll('#couponTabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#couponTabs .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });
  }

  // ─── 필터 ───
  function bindFilters() {
    const s = document.getElementById('cpnSearch');
    const t = document.getElementById('cpnTypeFilter');
    const st = document.getElementById('cpnStatusFilter');
    if (s) s.addEventListener('input', applyFilters);
    if (t) t.addEventListener('change', applyFilters);
    if (st) st.addEventListener('change', applyFilters);
  }

  function applyFilters() {
    const kw = (document.getElementById('cpnSearch')?.value || '').trim().toLowerCase();
    const tp = document.getElementById('cpnTypeFilter')?.value || 'all';
    const st = document.getElementById('cpnStatusFilter')?.value || 'all';
    filtered = allCoupons.filter(c => {
      if (kw && !c.name.toLowerCase().includes(kw)) return false;
      if (tp !== 'all' && c.type !== tp) return false;
      if (st !== 'all' && c.status !== st) return false;
      return true;
    });
    currentPage = 1;
    renderAll();
  }

  // ─── 렌더 ───
  function renderAll() {
    renderTable();
    renderMobileCards();
    renderPagination();
  }

  function typeLabel(t) { return t === 'single' ? '단일 코드' : '개별 코드'; }
  function statusLabel(s) {
    if (s === 'active') return '<span class="status-badge connected">활성</span>';
    if (s === 'exhausted') return '<span class="status-badge" style="background:#FEF3C7;color:#D97706;">소진</span>';
    return '<span class="status-badge disconnected">비활성</span>';
  }
  function stockDisplay(c) {
    if (c.type === 'individual') { const rem = c.codes.length - c.issued; return rem + ' / ' + c.codes.length; }
    if (c.stock === 'unlimited') return '무제한';
    return (c.stockLimit - c.issued) + ' / ' + c.stockLimit;
  }
  function stockPercent(c) {
    if (c.stock === 'unlimited') return 100;
    const total = c.type === 'individual' ? c.codes.length : c.stockLimit;
    if (total === 0) return 0;
    return ((total - c.issued) / total) * 100;
  }

  function renderTable() {
    const tb = document.getElementById('cpnTableBody');
    const cnt = document.getElementById('cpnListCount');
    const cntM = document.getElementById('cpnListCountM');
    const ct = '총 ' + filtered.length + '건';
    if (cnt) cnt.textContent = ct;
    if (cntM) cntM.textContent = ct;
    const start = (currentPage - 1) * PER_PAGE;
    const page = filtered.slice(start, start + PER_PAGE);
    if (!page.length) { tb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted);">등록된 쿠폰이 없습니다.</td></tr>'; return; }
    tb.innerHTML = page.map((c, i) => {
      const pct = stockPercent(c);
      const lowStock = pct > 0 && pct < 10;
      return `<tr>
        <td class="col-no">${start + i + 1}</td>
        <td><strong>${esc(c.name)}</strong></td>
        <td>${typeLabel(c.type)}</td>
        <td>${c.event || '-'}</td>
        <td>${stockDisplay(c)}${lowStock ? ' <span style="color:#DC2626;font-size:11px;font-weight:600;">⚠ 부족</span>' : ''}</td>
        <td>${c.issued}</td>
        <td>${c.createdAt}</td>
        <td>${statusLabel(c.status)}</td>
        <td class="col-action"><button class="btn btn-secondary btn-sm" onclick="couponDetail('${c.id}')">상세</button></td>
      </tr>`;
    }).join('');
  }

  function renderMobileCards() {
    const body = document.getElementById('cpnMobileCardBody');
    if (!body) return;
    const start = (currentPage - 1) * PER_PAGE;
    const page = filtered.slice(start, start + PER_PAGE);
    if (!page.length) { body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">등록된 쿠폰이 없습니다.</div>'; return; }
    body.innerHTML = page.map(c => {
      const pct = stockPercent(c);
      const lowStock = pct > 0 && pct < 10;
      const stCls = c.status === 'active' ? 'sent' : c.status === 'exhausted' ? 'pending' : 'cancelled';
      const stTxt = c.status === 'active' ? '활성' : c.status === 'exhausted' ? '소진' : '비활성';
      return `<div class="msg-card-item" onclick="couponDetail('${c.id}')">
        <div class="msg-card-row"><span class="msg-card-channel">${esc(c.name)}</span><span class="msg-card-status ${stCls}">${stTxt}</span></div>
        <div class="msg-card-preview">${typeLabel(c.type)} · 재고: ${stockDisplay(c)}${lowStock ? ' ⚠' : ''}</div>
        <div class="msg-card-row"><span class="msg-card-date">${c.createdAt}</span><span class="msg-card-manage">발급 ${c.issued}건</span></div>
      </div>`;
    }).join('');
  }

  function renderPagination() {
    const el = document.getElementById('cpnPagination');
    const tp = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    if (currentPage > tp) currentPage = tp;
    const mobile = window.innerWidth <= 1100;
    const mv = mobile ? 5 : 10;
    let sp = Math.max(1, currentPage - Math.floor(mv / 2));
    let ep = Math.min(tp, sp + mv - 1);
    if (ep - sp < mv - 1) sp = Math.max(1, ep - mv + 1);
    let h = `<button class="page-btn" ${currentPage===1?'disabled':''} onclick="cpnGoPage(1)">«</button>`;
    h += `<button class="page-btn" ${currentPage===1?'disabled':''} onclick="cpnGoPage(${currentPage-1})">‹</button>`;
    for (let i = sp; i <= ep; i++) h += `<button class="page-btn ${i===currentPage?'active':''}" onclick="cpnGoPage(${i})">${i}</button>`;
    h += `<button class="page-btn" ${currentPage===tp?'disabled':''} onclick="cpnGoPage(${currentPage+1})">›</button>`;
    h += `<button class="page-btn" ${currentPage===tp?'disabled':''} onclick="cpnGoPage(${tp})">»</button>`;
    el.innerHTML = h;
  }

  window.cpnGoPage = function (p) {
    const tp = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    if (p < 1 || p > tp) return;
    currentPage = p;
    renderAll();
  };

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ─── 폼 ───
  function bindForm() {
    // 유형 선택
    document.querySelectorAll('.cpn-type-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.cpn-type-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        const v = opt.querySelector('input').value;
        document.getElementById('singleCodeGroup').style.display = v === 'single' ? '' : 'none';
        document.getElementById('individualCodeGroup').style.display = v === 'individual' ? '' : 'none';
      });
    });

    // 재고 정책
    document.querySelectorAll('input[name="stockPolicy"]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('stockLimitGroup').style.display = r.value === 'limited' && r.checked ? '' : 'none';
      });
    });

    // 파일 업로드
    const uploadArea = document.getElementById('cpnUploadArea');
    const fileInput = document.getElementById('cpnFileInput');
    if (uploadArea) {
      uploadArea.addEventListener('click', () => fileInput.click());
      uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
      uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
      uploadArea.addEventListener('drop', e => { e.preventDefault(); uploadArea.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });
    }
    if (fileInput) fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

    const removeBtn = document.getElementById('cpnFileRemove');
    if (removeBtn) removeBtn.addEventListener('click', () => { uploadedCodes = []; document.getElementById('cpnFileInfo').style.display = 'none'; document.getElementById('cpnUploadArea').style.display = ''; fileInput.value = ''; });

    // 취소
    document.getElementById('cpnCancelBtn')?.addEventListener('click', () => {
      document.querySelector('#couponTabs .tab-btn[data-tab="tab-list"]')?.click();
    });

    // 제출
    document.getElementById('couponForm')?.addEventListener('submit', e => {
      e.preventDefault();
      submitCoupon();
    });
  }

  function handleFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'txt'].includes(ext)) { alert('CSV 또는 TXT 파일만 업로드 가능합니다.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const lines = e.target.result.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      uploadedCodes = lines;
      document.getElementById('cpnUploadArea').style.display = 'none';
      document.getElementById('cpnFileInfo').style.display = 'flex';
      document.getElementById('cpnFileName').textContent = file.name;
      document.getElementById('cpnFileCount').textContent = lines.length + '개 코드';
    };
    reader.readAsText(file);
  }

  function submitCoupon() {
    const name = document.getElementById('cpnName').value.trim();
    if (!name) { alert('쿠폰명을 입력해주세요.'); return; }
    const type = document.querySelector('input[name="cpnType"]:checked').value;
    let code = '', codes = [];
    if (type === 'single') {
      code = document.getElementById('cpnSingleCode').value.trim();
      if (!code) { alert('쿠폰 코드를 입력해주세요.'); return; }
    } else {
      if (uploadedCodes.length === 0) { alert('쿠폰 코드 파일을 업로드해주세요.'); return; }
      codes = [...uploadedCodes];
    }
    const stockPolicy = document.querySelector('input[name="stockPolicy"]:checked').value;
    let stockLimit = 0;
    if (stockPolicy === 'limited') {
      stockLimit = parseInt(document.getElementById('cpnStockLimit').value) || 0;
      if (stockLimit < 1) { alert('발급 수량을 입력해주세요.'); return; }
    }
    const coupon = {
      id: uid(), name, type, code, codes,
      stock: type === 'individual' ? 'limited' : stockPolicy,
      stockLimit: type === 'individual' ? codes.length : stockLimit,
      issued: 0,
      event: document.getElementById('cpnEvent').value || '',
      memo: document.getElementById('cpnMemo').value.trim(),
      status: 'active',
      createdAt: now()
    };
    allCoupons.unshift(coupon);
    save(allCoupons);
    alert('쿠폰이 등록되었습니다.');
    resetForm();
    document.querySelector('#couponTabs .tab-btn[data-tab="tab-list"]')?.click();
    applyFilters();
  }

  function resetForm() {
    document.getElementById('couponForm').reset();
    uploadedCodes = [];
    document.getElementById('singleCodeGroup').style.display = '';
    document.getElementById('individualCodeGroup').style.display = 'none';
    document.getElementById('cpnFileInfo').style.display = 'none';
    document.getElementById('cpnUploadArea').style.display = '';
    document.getElementById('stockLimitGroup').style.display = 'none';
    document.querySelectorAll('.cpn-type-option').forEach((o,i) => o.classList.toggle('active', i===0));
  }

  // ─── 모바일 필터 ───
  function bindMobileFilter() {
    const ov = document.getElementById('cpnFilterOverlay');
    document.getElementById('cpnMobileFilterBtn')?.addEventListener('click', () => { ov.classList.add('show'); document.body.style.overflow = 'hidden'; });
    function close() { ov.classList.remove('show'); document.body.style.overflow = ''; }
    document.getElementById('cpnFilterClose')?.addEventListener('click', close);
    ov?.addEventListener('click', e => { if (e.target === ov) close(); });

    ['cpnMTypeSw', 'cpnMStatusSw'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', e => {
        const b = e.target.closest('.msg-status-sw'); if (!b) return;
        document.querySelectorAll('#' + id + ' .msg-status-sw').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });

    document.getElementById('cpnMFilterApply')?.addEventListener('click', () => {
      document.getElementById('cpnSearch').value = document.getElementById('cpnMSearch')?.value || '';
      const tv = document.querySelector('#cpnMTypeSw .msg-status-sw.active')?.dataset.val || 'all';
      const sv = document.querySelector('#cpnMStatusSw .msg-status-sw.active')?.dataset.val || 'all';
      document.getElementById('cpnTypeFilter').value = tv;
      document.getElementById('cpnStatusFilter').value = sv;
      close();
      applyFilters();
    });
  }

  // ─── 상세 모달 ───
  function bindModals() {
    const dm = document.getElementById('cpnDetailModal');
    document.getElementById('cpnDetailClose')?.addEventListener('click', () => { dm.style.display = 'none'; });
    dm?.addEventListener('click', e => { if (e.target === dm) dm.style.display = 'none'; });

    const am = document.getElementById('cpnAddCodesModal');
    document.getElementById('cpnAddCodesClose')?.addEventListener('click', () => { am.style.display = 'none'; });
    document.getElementById('cpnAddCodesCancel')?.addEventListener('click', () => { am.style.display = 'none'; });
    am?.addEventListener('click', e => { if (e.target === am) am.style.display = 'none'; });

    // 추가 업로드
    const addArea = document.getElementById('cpnAddUploadArea');
    const addInput = document.getElementById('cpnAddFileInput');
    let addCodes = [];
    if (addArea) {
      addArea.addEventListener('click', () => addInput.click());
    }
    if (addInput) addInput.addEventListener('change', () => {
      const file = addInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        addCodes = e.target.result.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        document.getElementById('cpnAddFileInfo').style.display = 'flex';
        document.getElementById('cpnAddFileName').textContent = file.name;
        document.getElementById('cpnAddFileCount').textContent = addCodes.length + '개 코드';
        document.getElementById('cpnAddCodesSubmit').disabled = false;
      };
      reader.readAsText(file);
    });

    document.getElementById('cpnAddCodesSubmit')?.addEventListener('click', () => {
      if (!addCodes.length || !window._cpnDetailId) return;
      const c = allCoupons.find(x => x.id === window._cpnDetailId);
      if (c) {
        c.codes = c.codes.concat(addCodes);
        c.stockLimit = c.codes.length;
        if (c.status === 'exhausted' && c.issued < c.codes.length) c.status = 'active';
        save(allCoupons);
        alert(addCodes.length + '개 코드가 추가되었습니다.');
        am.style.display = 'none';
        addCodes = [];
        addInput.value = '';
        document.getElementById('cpnAddFileInfo').style.display = 'none';
        document.getElementById('cpnAddCodesSubmit').disabled = true;
        applyFilters();
        couponDetail(window._cpnDetailId);
      }
    });
  }

  window.couponDetail = function (id) {
    window._cpnDetailId = id;
    const c = allCoupons.find(x => x.id === id);
    if (!c) return;
    const pct = stockPercent(c);
    const lowStock = pct > 0 && pct < 10;
    const body = document.getElementById('cpnDetailBody');
    body.innerHTML = `
      <div class="detail-info-grid" style="margin-bottom:20px;">
        <div class="detail-row"><div class="detail-label">쿠폰명</div><div class="detail-value"><strong>${esc(c.name)}</strong></div></div>
        <div class="detail-row"><div class="detail-label">유형</div><div class="detail-value">${typeLabel(c.type)}</div></div>
        ${c.type === 'single' ? `<div class="detail-row"><div class="detail-label">쿠폰 코드</div><div class="detail-value"><code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;font-size:13px;">${esc(c.code)}</code></div></div>` : ''}
        <div class="detail-row"><div class="detail-label">재고</div><div class="detail-value">${stockDisplay(c)}${lowStock ? ' <span style="color:#DC2626;font-weight:600;">⚠ 잔여 10% 미만</span>' : ''}</div></div>
        <div class="detail-row"><div class="detail-label">발급 수</div><div class="detail-value">${c.issued}건</div></div>
        <div class="detail-row"><div class="detail-label">상태</div><div class="detail-value">${statusLabel(c.status)}</div></div>
        <div class="detail-row"><div class="detail-label">등록일</div><div class="detail-value">${c.createdAt}</div></div>
        ${c.memo ? `<div class="detail-row"><div class="detail-label">메모</div><div class="detail-value">${esc(c.memo)}</div></div>` : ''}
      </div>
      ${c.type === 'individual' ? `<div style="margin-bottom:16px;"><button class="btn btn-secondary btn-sm" id="cpnAddCodesBtn">코드 추가 업로드</button></div>` : ''}
      <div class="flex justify-end gap-2" style="border-top:1px solid var(--border-color);padding-top:16px;">
        ${c.status === 'active' ? `<button class="btn btn-secondary" onclick="cpnToggleStatus('${c.id}','inactive')">비활성화</button>` : `<button class="btn btn-primary" onclick="cpnToggleStatus('${c.id}','active')">활성화</button>`}
        <button class="btn btn-danger" onclick="cpnDelete('${c.id}')">삭제</button>
      </div>`;
    document.getElementById('cpnAddCodesBtn')?.addEventListener('click', () => {
      document.getElementById('cpnAddCodesModal').style.display = 'flex';
    });
    document.getElementById('cpnDetailModal').style.display = 'flex';
  };

  window.cpnToggleStatus = function (id, status) {
    const c = allCoupons.find(x => x.id === id);
    if (c) { c.status = status; save(allCoupons); applyFilters(); couponDetail(id); }
  };

  window.cpnDelete = function (id) {
    if (!confirm('이 쿠폰을 삭제하시겠습니까?')) return;
    allCoupons = allCoupons.filter(x => x.id !== id);
    save(allCoupons);
    document.getElementById('cpnDetailModal').style.display = 'none';
    applyFilters();
  };

  // ─── 실행 ───
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
