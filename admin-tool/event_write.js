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

  async function init() {
    const params = new URLSearchParams(location.search);
    const title = params.get('title') || 'RO1';
    editId = params.get('edit');
    isEditMode = !!editId;

    // Quill 초기화 — CDN 로드 실패 시 textarea 폴백으로 대체
    try {
      if (typeof Quill !== 'undefined') {
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
      } else {
        document.getElementById('editor-container').style.display = 'none';
        const ta = document.getElementById('evtAnnounceMsg');
        ta.style.display = '';
        ta.rows = 8;
        ta.placeholder = '공지 메시지 내용을 입력하세요...';
      }
    } catch (e) {
      console.error('Quill 초기화 실패:', e);
      document.getElementById('editor-container').style.display = 'none';
      const ta = document.getElementById('evtAnnounceMsg');
      ta.style.display = '';
      ta.rows = 8;
      ta.placeholder = '공지 메시지 내용을 입력하세요...';
    }

    document.getElementById('pageTitle').textContent = title + (isEditMode ? ' - 이벤트 수정' : ' - 이벤트 등록');
    
    // 채널 목록 로드 (최대 3회 재시도)
    async function loadChannels(retryCount = 0) {
      try {
        const channels = await apiRequest('/channels');
        const dropdown = document.getElementById('evtChannelDropdown');
        dropdown.innerHTML = '';
        if (channels && channels.data && channels.data.length > 0) {
          channels.data.forEach(ch => {
            const opt = document.createElement('div');
            opt.className = 'multi-select-option channel-option';
            opt.dataset.value = ch.id;
            opt.textContent = '# ' + ch.name;
            dropdown.appendChild(opt);
          });

          const selectedTextEl = document.getElementById('channelSelectedText');
          const hiddenInput = document.getElementById('evtChannel');

          dropdown.querySelectorAll('.channel-option').forEach(opt => {
            opt.addEventListener('click', () => {
              dropdown.querySelectorAll('.channel-option').forEach(o => o.classList.remove('selected'));
              opt.classList.add('selected');
              selectedTextEl.textContent = opt.textContent.trim();
              selectedTextEl.style.color = 'var(--text-main)';
              hiddenInput.value = opt.dataset.value;
              dropdown.classList.remove('active');
            });
          });
        } else {
          dropdown.innerHTML = '<div style="padding: 10px; color: red;">채널 목록을 불러오지 못했습니다.</div>';
        }
      } catch(err) {
        console.error('채널 로드 에러 (시도 ' + (retryCount + 1) + '/3):', err);
        if (retryCount < 2) {
          // Discord 봇이 아직 준비 안됐을 수 있으므로 2초 후 재시도
          const dropdown = document.getElementById('evtChannelDropdown');
          if (dropdown) dropdown.innerHTML = '<div style="padding: 10px; color: #666;">채널 목록 로드 재시도 중... (' + (retryCount + 2) + '/3)</div>';
          await new Promise(r => setTimeout(r, 2000));
          return loadChannels(retryCount + 1);
        }
        const dropdown = document.getElementById('evtChannelDropdown');
        const errMsg = err.message || '알 수 없는 에러';
        if (dropdown) dropdown.innerHTML = '<div style="padding: 10px; color: red;">채널 로드 에러 발생<br><small style="color:#888;">' + errMsg + '</small></div>';
      }
    }
    await loadChannels();

    if (isEditMode) {
      document.getElementById('cardTitle').textContent = '이벤트 수정하기';
      const submitBtn = document.getElementById('evtSubmitBtn');
      if (submitBtn) submitBtn.textContent = '수정하기';

      try {
        const res = await apiRequest('/events');
        const events = res.events || [];
        const e = events.find(e => String(e.id) === String(editId));
        if (!e) { alert('이벤트를 찾을 수 없습니다.'); location.href='event_mgmt.html'; return; }
        editEvt = {
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
          cpnCodesPool: e.cpn_codes_pool || null,
          memo: e.memo,
          status: e.status
        };
        loadEventData();
      } catch (err) {
        console.error(err);
        alert('이벤트를 찾을 수 없습니다.'); location.href='event_mgmt.html';
      }
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
    } else if (!window.quill && editEvt.announceMsg) {
      document.getElementById('evtAnnounceMsg').value = editEvt.announceMsg;
    }
    document.getElementById('evtStartDate').value = editEvt.startDate || '';
    document.getElementById('evtEndDate').value = editEvt.endDate || '';
    document.getElementById('evtChannel').value = editEvt.channel || '';

    // 드롭다운 값 복원 및 비활성화
    setTimeout(() => {
      const selectedOpt = document.querySelector(`.channel-option[data-value="${editEvt.channel}"]`);
      if (selectedOpt) {
        selectedOpt.classList.add('selected');
        const selectedTextEl = document.getElementById('channelSelectedText');
        selectedTextEl.textContent = selectedOpt.textContent.trim();
        selectedTextEl.style.color = 'var(--text-main)';
      }
      const multiSelectTrigger = document.querySelector('.multi-select-trigger');
      if (multiSelectTrigger) {
        multiSelectTrigger.style.pointerEvents = 'none';
        multiSelectTrigger.style.backgroundColor = 'var(--bg-surface)';
      }
      document.querySelectorAll('.channel-option').forEach(o => {
        o.style.pointerEvents = 'none';
        o.style.opacity = '0.7';
      });
    }, 100);
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
      // 수정 모드: 기존 코드 다운로드 영역 표시
      const dlArea = document.getElementById('cpnDownloadArea');
      dlArea.style.display = 'flex';

      if (editEvt.cpnCodesPool) {
        try {
          const pool = JSON.parse(editEvt.cpnCodesPool);
          document.getElementById('cpnDownloadName').textContent = '등록된 쿠폰 코드 파일';
          document.getElementById('cpnDownloadCount').textContent = '잔여 ' + pool.length + '개 코드';
          document.getElementById('cpnDownloadBtn').onclick = function () {
            const blob = new Blob([pool.join('\n')], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'coupon_codes_' + (editEvt.title || 'event') + '.txt';
            a.click();
            URL.revokeObjectURL(url);
          };
        } catch (e) {
          document.getElementById('cpnDownloadCount').textContent = '코드 데이터 없음';
          document.getElementById('cpnDownloadBtn').disabled = true;
        }
      } else {
        document.getElementById('cpnDownloadName').textContent = '등록된 쿠폰 코드 없음';
        document.getElementById('cpnDownloadCount').textContent = '아래에서 파일을 업로드해주세요';
        document.getElementById('cpnDownloadBtn').disabled = true;
      }

      // 수정 모드: 업로드 영역 및 라벨 숨김
      document.getElementById('cpnUploadArea').style.display = 'none';
      document.getElementById('cpnUploadLabel') && (document.getElementById('cpnUploadLabel').style.display = 'none');
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
    const channelVal = document.getElementById('evtChannel').value.trim();
    if (!channelVal) { alert('적용 채널을 선택해주세요.'); return; }

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
      // 수정 모드에서는 새 파일 없으면 기존 코드 유지 (파일 업로드 선택사항)
      if (!isEditMode && uploadedCodes.length === 0) { alert('쿠폰 코드 파일을 업로드해주세요.'); return; }
      if (uploadedCodes.length > 0) {
        cpnCodes = [...uploadedCodes];
        cpnStockLimit = cpnCodes.length;
      } else {
        // 수정 모드 + 새 파일 없음 → 기존 재고 수량 유지
        cpnStockLimit = editEvt ? (editEvt.cpnStockLimit || 0) : 0;
      }
      cpnStock = 'limited';
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
      type: document.querySelector('input[name="evtType"]:checked').value,
      targetTitle: new URLSearchParams(location.search).get('title') || 'RO1',
      title: t,
      description: document.getElementById('evtDesc').value.trim(),
      announceMsg: announceMsg,
      startDate: sd, endDate: ed,
      channelId: document.getElementById('evtChannel').value.trim(),
      commandName: document.getElementById('evtCommand').value.trim(),
      daily: document.querySelector('input[name="evtDaily"]:checked')?.value || 'off',
      dailyStart: document.getElementById('evtDailyStart')?.value || '',
      dailyEnd: document.getElementById('evtDailyEnd')?.value || '',
      couponMethod: document.querySelector('input[name="evtCouponMethod"]:checked')?.value || 'auto',
      cpnType, cpnCode, cpnCodes, cpnStock, cpnStockLimit,
      memo: document.getElementById('evtMemo').value.trim(),
      status: status
    };

    if (isEditMode) {
      // Update via API
      fetch((window.API_CONFIG ? window.API_CONFIG.BASE_URL : '/api') + '/events/' + editId, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': window.API_CONFIG ? window.API_CONFIG.API_KEY : '',
          'Authorization': 'Bearer ' + localStorage.getItem('gv_auth_token')
        },
        body: JSON.stringify(evtData)
      }).then(() => {
        alert('이벤트가 수정되었습니다.');
        const titleParams = new URLSearchParams(location.search).get('title') || '';
        location.href = 'event_mgmt.html' + (titleParams ? '?title=' + encodeURIComponent(titleParams) : '');
      }).catch(e => console.error('API Error:', e));
    } else {
      evtData.author = author;

      // Create via API
      fetch((window.API_CONFIG ? window.API_CONFIG.BASE_URL : '/api') + '/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': window.API_CONFIG ? window.API_CONFIG.API_KEY : '',
          'Authorization': 'Bearer ' + localStorage.getItem('gv_auth_token')
        },
        body: JSON.stringify(evtData)
      }).then(() => {
        if (window.refreshLNB) window.refreshLNB();
        alert('이벤트가 등록되었습니다.');
        const titleParams = new URLSearchParams(location.search).get('title') || '';
        location.href = 'event_mgmt.html' + (titleParams ? '?title=' + encodeURIComponent(titleParams) : '');
      }).catch(e => console.error('API Error:', e));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // 외부 클릭 시 드롭다운 닫기
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.multi-select-container')) {
      document.querySelectorAll('.multi-select-dropdown').forEach(d => d.classList.remove('active'));
    }
  });
})();
