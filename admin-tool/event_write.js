/**
 * event_write.js — 이벤트 등록 로직
 */
(function () {
  'use strict';
  const EVT_KEY = 'gv_events';
  let uploadedCodes = [];
  let isEditMode = false;
  let editId = null;
  let editEvt = null;

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function now() { const d = new Date(); return d.getFullYear()+'-'+S(d.getMonth()+1)+'-'+S(d.getDate())+' '+S(d.getHours())+':'+S(d.getMinutes())+':'+S(d.getSeconds()); }
  function S(n) { return String(n).padStart(2,'0'); }

  function init() {
    const params = new URLSearchParams(location.search);
    const title = params.get('title') || 'RO1';
    editId = params.get('edit');
    isEditMode = !!editId;

    window.quill = new Quill('#editor-container', {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
          ['link', 'image', 'video'],
          ['clean']
        ]
      },
      placeholder: '공지 메시지 내용을 입력하세요...'
    });

    document.getElementById('pageTitle').textContent = title + (isEditMode ? ' - 이벤트 수정' : ' - 이벤트 등록');
    fetchChannels().then(() => {
      if (isEditMode) {
        document.getElementById('cardTitle').textContent = '이벤트 수정하기';
        const submitBtn = document.getElementById('evtSubmitBtn');
        if (submitBtn) submitBtn.textContent = '수정하기';

        const events = JSON.parse(localStorage.getItem(EVT_KEY) || '[]');
        editEvt = events.find(e => e.id === editId);
        if (!editEvt) { alert('이벤트를 찾을 수 없습니다.'); location.href='event_mgmt.html'; return; }
        loadEventData();
      }
    });

  function fetchChannels() {
    return fetch(window.API_CONFIG ? window.API_CONFIG.BASE_URL + '/channels' : '/api/channels', {
      headers: {
        'x-api-key': window.API_CONFIG ? window.API_CONFIG.API_KEY : '',
        'Authorization': 'Bearer ' + localStorage.getItem('gv_auth_token')
      }
    })
    .then(res => res.json())
    .then(data => {
      const select = document.getElementById('evtChannel');
      select.innerHTML = '<option value="">채널 선택</option>';
      if (data.success && data.channels) {
        data.channels.forEach(ch => {
          const opt = document.createElement('option');
          opt.value = ch.id;
          opt.textContent = ch.name + ' (' + ch.id + ')';
          select.appendChild(opt);
        });
      }
    })
    .catch(err => console.error('채널 로드 에러:', err));
  }

    // 이벤트 활성 상태 토글
    const toggle = document.getElementById('evtStatusToggle');

    // 이벤트 유형 선택
    document.querySelectorAll('.evt-type-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.evt-type-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        document.getElementById('evtTextOptions').style.display = opt.querySelector('input').value === 'text' ? '' : 'none';
      });
    });

    // 데일리 반복
    document.querySelectorAll('input[name="evtDaily"]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('evtDailyTimeRow').style.display = r.value === 'on' && r.checked ? '' : 'none';
      });
    });

    // 쿠폰 코드 유형
    document.querySelectorAll('.cpn-type-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.cpn-type-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        const v = opt.querySelector('input').value;
        document.getElementById('singleCodeGroup').style.display = v === 'single' ? '' : 'none';
        document.getElementById('individualCodeGroup').style.display = v === 'individual' ? '' : 'none';
      });
    });

    // 단일 코드 재고 정책
    document.querySelectorAll('input[name="singleStockPolicy"]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('singleStockLimitGroup').style.display = r.value === 'limited' && r.checked ? '' : 'none';
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

    document.getElementById('cpnFileRemove')?.addEventListener('click', () => {
      uploadedCodes = [];
      document.getElementById('cpnFileInfo').style.display = 'none';
      document.getElementById('cpnUploadArea').style.display = '';
      fileInput.value = '';
    });

    // 목록 버튼
    const title2 = params.get('title') || '';
    document.getElementById('evtBackBtn')?.addEventListener('click', () => {
      location.href = 'event_mgmt.html' + (title2 ? '?title=' + encodeURIComponent(title2) : '');
    });

    // 제출
    document.getElementById('eventForm')?.addEventListener('submit', e => {
      e.preventDefault();
      if (isEditMode) {
        if (!confirm('이벤트 내용을 수정하시겠습니까?')) {
          return;
        }
      }
      submitEvent();
    });
  }

  function handleFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'txt'].includes(ext)) { alert('CSV 또는 TXT 파일만 업로드 가능합니다.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      uploadedCodes = e.target.result.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      document.getElementById('cpnUploadArea').style.display = 'none';
      document.getElementById('cpnFileInfo').style.display = 'flex';
      document.getElementById('cpnFileName').textContent = file.name;
      document.getElementById('cpnFileCount').textContent = uploadedCodes.length + '개 코드';
    };
    reader.readAsText(file);
  }

  function loadEventData() {
    document.getElementById('evtStatusGroup').style.display = '';
    const toggle = document.getElementById('evtStatusToggle');
    toggle.checked = editEvt.status !== 'inactive';

    // 비활성화 항목들
    document.querySelectorAll('input[name="evtType"]').forEach(r => r.disabled = true);
    document.getElementById('evtChannel').disabled = true;
    document.getElementById('evtCommand').disabled = true;

    // 데이터 세팅
    document.querySelector(`input[name="evtType"][value="${editEvt.type}"]`).checked = true;
    document.querySelectorAll('.evt-type-option').forEach(o => o.classList.remove('active'));
    document.querySelector(`input[name="evtType"][value="${editEvt.type}"]`).closest('.evt-type-option').classList.add('active');
    document.getElementById('evtTextOptions').style.display = editEvt.type === 'text' ? '' : 'none';

    document.getElementById('evtTitle').value = editEvt.title || '';
    document.getElementById('evtDesc').value = editEvt.desc || '';
    if (window.quill && editEvt.announceMsg) {
      window.quill.clipboard.dangerouslyPasteHTML(editEvt.announceMsg.replace(/\n/g, '<br>'));
    }
    document.getElementById('evtStartDate').value = editEvt.startDate || '';
    document.getElementById('evtEndDate').value = editEvt.endDate || '';
    document.getElementById('evtChannel').value = editEvt.channel || '';
    document.getElementById('evtChannel').disabled = true;
    document.getElementById('evtCommand').value = editEvt.command || '';
    document.getElementById('evtCommand').disabled = true;

    document.querySelectorAll('input[name="evtCouponMethod"]').forEach(el => el.disabled = true);
    document.querySelectorAll('input[name="cpnType"]').forEach(el => el.disabled = true);
    document.querySelectorAll('.cpn-type-option').forEach(el => {
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.7';
    });

    if (editEvt.daily === 'on') document.querySelector('input[name="evtDaily"][value="on"]').checked = true;
    document.getElementById('evtDailyTimeRow').style.display = editEvt.daily === 'on' ? '' : 'none';
    if (editEvt.dailyStart) document.getElementById('evtDailyStart').value = editEvt.dailyStart;
    if (editEvt.dailyEnd) document.getElementById('evtDailyEnd').value = editEvt.dailyEnd;

    document.querySelector(`input[name="evtCouponMethod"][value="${editEvt.couponMethod||'auto'}"]`).checked = true;

    document.querySelector(`input[name="cpnType"][value="${editEvt.cpnType||'single'}"]`).checked = true;
    document.querySelectorAll('.cpn-type-option').forEach(o => o.classList.remove('active'));
    document.querySelector(`input[name="cpnType"][value="${editEvt.cpnType||'single'}"]`).closest('.cpn-type-option').classList.add('active');
    document.getElementById('singleCodeGroup').style.display = editEvt.cpnType === 'single' ? '' : 'none';
    document.getElementById('individualCodeGroup').style.display = editEvt.cpnType === 'individual' ? '' : 'none';

    if (editEvt.cpnType === 'single') {
      document.getElementById('cpnSingleCode').value = editEvt.cpnCode || '';
      document.getElementById('cpnSingleCode').disabled = true; // 단일코드도 수정불가
      document.querySelector(`input[name="singleStockPolicy"][value="${editEvt.cpnStock||'unlimited'}"]`).checked = true;
      if (editEvt.cpnStock === 'limited') {
        document.getElementById('singleStockLimitGroup').style.display = '';
        document.getElementById('singleStockLimit').value = editEvt.cpnStockLimit || '';
      }
    } else {
      if (editEvt.cpnCodes && editEvt.cpnCodes.length > 0) {
        uploadedCodes = editEvt.cpnCodes;
        document.getElementById('cpnFileInfo').style.display = 'flex';
        document.getElementById('cpnFileName').textContent = '기존 업로드 파일 (' + uploadedCodes.length + '개 코드 유지됨)';
        document.getElementById('cpnFileCount').textContent = '새 파일 업로드 시 대체됨';
      }
    }
    document.getElementById('evtMemo').value = editEvt.memo || '';
  }

  function submitEvent() {
    const t = document.getElementById('evtTitle').value.trim();
    if (!t) { alert('이벤트 제목을 입력해주세요.'); return; }
    const sd = document.getElementById('evtStartDate').value;
    const ed = document.getElementById('evtEndDate').value;
    if (!sd || !ed) { alert('이벤트 기간을 설정해주세요.'); return; }
    if (sd > ed) { alert('종료일은 시작일 이후여야 합니다.'); return; }

    const cpnType = document.querySelector('input[name="cpnType"]:checked').value;
    let cpnCode = '', cpnCodes = [], cpnStock = 'unlimited', cpnStockLimit = 0;

    if (cpnType === 'single') {
      cpnCode = document.getElementById('cpnSingleCode').value.trim();
      if (!cpnCode) { alert('쿠폰 코드를 입력해주세요.'); return; }
      const sp = document.querySelector('input[name="singleStockPolicy"]:checked').value;
      cpnStock = sp;
      if (sp === 'limited') {
        cpnStockLimit = parseInt(document.getElementById('singleStockLimit').value) || 0;
        if (cpnStockLimit < 1) { alert('재고 수량을 입력해주세요.'); return; }
      }
    } else {
      if (uploadedCodes.length === 0) { alert('쿠폰 코드 파일을 업로드해주세요.'); return; }
      cpnCodes = [...uploadedCodes];
      cpnStock = 'limited';
      cpnStockLimit = cpnCodes.length;
    }

    let announceMsg = '';
    if (window.quill) {
      const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
      turndownService.addRule('strikethrough', {
        filter: ['s', 'strike', 'del'],
        replacement: function (content) { return '~~' + content + '~~' }
      });
      announceMsg = turndownService.turndown(window.quill.root.innerHTML);
    }

    const user = typeof getStoredUser === 'function' ? getStoredUser() : null;
    const author = (user && user.loginId) || '관리자';

    const status = isEditMode && !document.getElementById('evtStatusToggle').checked ? 'inactive' : 'active';
    
    const evtData = {
      id: isEditMode ? editId : uid(),
      type: document.querySelector('input[name="evtType"]:checked').value,
      title: t,
      desc: document.getElementById('evtDesc').value.trim(),
      announceMsg: announceMsg,
      startDate: sd, endDate: ed,
      channel: document.getElementById('evtChannel').value.trim(),
      command: document.getElementById('evtCommand').value.trim(),
      daily: document.querySelector('input[name="evtDaily"]:checked')?.value || 'off',
      dailyStart: document.getElementById('evtDailyStart')?.value || '',
      dailyEnd: document.getElementById('evtDailyEnd')?.value || '',
      couponMethod: document.querySelector('input[name="evtCouponMethod"]:checked')?.value || 'auto',
      cpnType, cpnCode, cpnCodes, cpnStock, cpnStockLimit,
      memo: document.getElementById('evtMemo').value.trim(),
      status: status
    };

    const events = JSON.parse(localStorage.getItem(EVT_KEY) || '[]');
    if (isEditMode) {
      const idx = events.findIndex(e => e.id === editId);
      if (idx !== -1) {
        events[idx] = { ...events[idx], ...evtData };
      }
      localStorage.setItem(EVT_KEY, JSON.stringify(events));
      
      // Update via API
      fetch((window.API_CONFIG ? window.API_CONFIG.BASE_URL : '/api') + '/events/' + editId, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': window.API_CONFIG ? window.API_CONFIG.API_KEY : '',
          'Authorization': 'Bearer ' + localStorage.getItem('gv_auth_token')
        },
        body: JSON.stringify(evtData)
      }).catch(e => console.error('API Error:', e));

      alert('이벤트가 수정되었습니다.');
    } else {
      evtData.author = author;
      evtData.createdAt = now();
      evtData.cpnIssued = 0;
      events.unshift(evtData);
      localStorage.setItem(EVT_KEY, JSON.stringify(events));

      // Add Notification
      const titleName = new URLSearchParams(window.location.search).get('title') || 'RO1';
      let notis = JSON.parse(localStorage.getItem('gv_notifications') || '[]');
      notis.unshift({
        id: new Date().getTime(),
        type: 'new_event',
        title: `${titleName} · ${evtData.title}`,
        desc: '새로운 이벤트가 등록되었습니다.',
        date: new Date().toISOString(),
        isRead: false
      });
      localStorage.setItem('gv_notifications', JSON.stringify(notis));
      if (window.refreshLNB) window.refreshLNB();

      // Create via API
      fetch((window.API_CONFIG ? window.API_CONFIG.BASE_URL : '/api') + '/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': window.API_CONFIG ? window.API_CONFIG.API_KEY : '',
          'Authorization': 'Bearer ' + localStorage.getItem('gv_auth_token')
        },
        body: JSON.stringify(evtData)
      }).catch(e => console.error('API Error:', e));

      alert('이벤트가 등록되었습니다.');
    }
    const title = new URLSearchParams(location.search).get('title') || '';
    location.href = 'event_mgmt.html' + (title ? '?title=' + encodeURIComponent(title) : '');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
