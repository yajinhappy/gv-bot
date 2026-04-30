// script.js (LNB 로직은 lnb.js로 이관됨)

document.addEventListener('DOMContentLoaded', () => {
  // 전역 이벤트 위임
  document.addEventListener('click', (e) => {
    // Phase 2 메뉴 아이템 클릭 시 '준비중입니다' 알럿 표시
    if (e.target.closest('.phase2-item')) {
      e.preventDefault();
      alert('준비중입니다.');
      return;
    }
  });

  // (이전의 개별 이벤트 리스너 제거됨)

  // 임시 메시지 발송 폼 제출 막기 (프로토타입용)
  const msgForm = document.getElementById('msg-form');
  if (msgForm) {
    msgForm.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('메시지 예약이 임시 저장/등록 되었습니다. (프로토타입)');
    });
  }
  // 탭 전환 스크립트 (기존 유지, 필요 시)
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  if (tabBtns.length > 0) {
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // 모든 버튼 및 탭 컨텐츠의 active 클래스 제거
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));
        
        // 클릭한 버튼 및 대상 탭 컨텐츠에 active 클래스 추가
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        const targetPane = document.getElementById(targetId);
        if (targetPane) {
          targetPane.classList.add('active');
        }
      });
    });
  }

  // 필터 버튼 및 테이블 목록 연동 스크립트
  const filterBtns = document.querySelectorAll('.filter-btn');
  const tableRows = document.querySelectorAll('tbody tr');

  if (filterBtns.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // 활성화 상태 토글
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 테이블 연동 (선택된 버튼 텍스트 기준 필터링)
        if (tableRows.length > 0) {
          const filterText = btn.textContent.trim();

          tableRows.forEach(row => {
            // 상태 열은 8번째 열(인덱스 7)에 위치함
            const statusCell = row.cells[7];
            if (statusCell) {
              const statusText = statusCell.textContent.trim();
              if (filterText === '전체' || statusText === filterText) {
                row.style.display = ''; // 보이기
              } else {
                row.style.display = 'none'; // 숨기기
              }
            }
          });
        }
      });
    });
  }

  // 마이페이지 모달(드롭다운) 토글
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userDropdown = document.getElementById('userDropdown');
  
  if (userProfileBtn && userDropdown) {
    userProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('show');
    });

    // 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
      if (!userProfileBtn.contains(e.target)) {
        userDropdown.classList.remove('show');
      }
    });
  }

  // 로그아웃 버튼
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof apiLogout === 'function') {
        apiLogout();
      } else {
        window.location.href = 'login.html';
      }
    });
  }

  // 인증 가드: api-client.js 로드 후 requireAuth 호출
  if (typeof requireAuth === 'function') {
    requireAuth();
  }

  // =========================================
  //  Date Range Picker 스크립트
  // =========================================
  const daterangePicker = document.getElementById('daterangePicker');
  if (daterangePicker) {
    const trigger = document.getElementById('daterangeTrigger');
    const dropdown = document.getElementById('daterangeDropdown');
    const label = document.getElementById('daterangeLabel');
    const calLeftGrid = document.getElementById('calLeftGrid');
    const calRightGrid = document.getElementById('calRightGrid');
    const calLeftTitle = document.getElementById('calLeftTitle');
    const calRightTitle = document.getElementById('calRightTitle');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const prevYearBtn = document.getElementById('prevYear');
    const nextYearBtn = document.getElementById('nextYear');
    const confirmBtn = document.getElementById('daterangeConfirm');
    const resetBtn = document.getElementById('daterangeReset');

    const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let currentLeftDate = new Date(); // 왼쪽 캘린더 기준 월
    currentLeftDate.setDate(1);

    let rangeStart = null;
    let rangeEnd = null;
    let isSelectingEnd = false; // true면 종료일 선택 중

    // 저장 버튼 활성/비활성 상태 업데이트
    function updateConfirmBtn() {
      confirmBtn.disabled = !(rangeStart && rangeEnd);
    }

    // 드롭다운 토글
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('show');
      if (isOpen) {
        closeDropdown();
      } else {
        dropdown.classList.add('show');
        trigger.classList.add('active');
        renderCalendars();
      }
    });

    function closeDropdown() {
      dropdown.classList.remove('show');
      trigger.classList.remove('active');
    }

    // 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
      if (!daterangePicker.contains(e.target)) {
        closeDropdown();
      }
    });

    // 달 이동
    prevMonthBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentLeftDate.setMonth(currentLeftDate.getMonth() - 1);
      renderCalendars();
    });

    nextMonthBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentLeftDate.setMonth(currentLeftDate.getMonth() + 1);
      renderCalendars();
    });

    prevYearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentLeftDate.setFullYear(currentLeftDate.getFullYear() - 1);
      renderCalendars();
    });

    nextYearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentLeftDate.setFullYear(currentLeftDate.getFullYear() + 1);
      renderCalendars();
    });

    // 초기화 버튼
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      rangeStart = null;
      rangeEnd = null;
      isSelectingEnd = false;
      label.textContent = '기간: 전체';
      currentLeftDate = new Date();
      currentLeftDate.setDate(1);
      renderCalendars();
      updateConfirmBtn();
    });

    // 저장 버튼
    confirmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (rangeStart && rangeEnd) {
        label.textContent = formatDate(rangeStart) + ' ~ ' + formatDate(rangeEnd);
      } else {
        label.textContent = '기간: 전체';
      }
      closeDropdown();
    });

    function formatDate(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    function isSameDay(a, b) {
      if (!a || !b) return false;
      return a.getFullYear() === b.getFullYear() &&
             a.getMonth() === b.getMonth() &&
             a.getDate() === b.getDate();
    }

    function renderCalendars() {
      const leftYear = currentLeftDate.getFullYear();
      const leftMonth = currentLeftDate.getMonth();

      // 오른쪽은 왼쪽 + 1달
      const rightDate = new Date(leftYear, leftMonth + 1, 1);
      const rightYear = rightDate.getFullYear();
      const rightMonth = rightDate.getMonth();

      calLeftTitle.textContent = `${getMonthName(leftMonth)} ${leftYear}`;
      calRightTitle.textContent = `${getMonthName(rightMonth)} ${rightYear}`;

      renderMonth(calLeftGrid, leftYear, leftMonth);
      renderMonth(calRightGrid, rightYear, rightMonth);
    }

    function getMonthName(monthIndex) {
      const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return names[monthIndex];
    }

    function renderMonth(container, year, month) {
      container.innerHTML = '';

      // 요일 헤더
      WEEKDAYS.forEach(wd => {
        const el = document.createElement('div');
        el.className = 'cal-weekday';
        el.textContent = wd;
        container.appendChild(el);
      });

      // 해당 월 1일의 요일 (월=0 기준)
      const firstDay = new Date(year, month, 1);
      let startDow = firstDay.getDay(); // 0=일, 1=월...
      startDow = startDow === 0 ? 6 : startDow - 1; // 월요일=0으로 변환

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const prevMonthDays = new Date(year, month, 0).getDate();

      const today = new Date();

      // 이전 달 날짜 채우기
      for (let i = startDow - 1; i >= 0; i--) {
        const el = document.createElement('div');
        el.className = 'cal-day other-month';
        el.textContent = prevMonthDays - i;
        container.appendChild(el);
      }

      // 현재 달 날짜
      for (let d = 1; d <= daysInMonth; d++) {
        const el = document.createElement('div');
        el.className = 'cal-day';
        el.textContent = d;

        const cellDate = new Date(year, month, d);

        // 오늘 표시
        if (isSameDay(cellDate, today)) {
          el.classList.add('today');
        }

        // 범위 표시
        if (rangeStart && rangeEnd) {
          if (isSameDay(cellDate, rangeStart)) {
            el.classList.add('range-start');
          } else if (isSameDay(cellDate, rangeEnd)) {
            el.classList.add('range-end');
          } else if (cellDate > rangeStart && cellDate < rangeEnd) {
            el.classList.add('in-range');
          }
        } else if (rangeStart && isSameDay(cellDate, rangeStart)) {
          el.classList.add('selected');
        }

        // 클릭 이벤트
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          handleDayClick(cellDate);
        });

        container.appendChild(el);
      }

      // 다음 달 날짜 채우기 (6행 고정)
      const totalCells = startDow + daysInMonth;
      const remainingCells = (Math.ceil(totalCells / 7) * 7) - totalCells;
      for (let i = 1; i <= remainingCells; i++) {
        const el = document.createElement('div');
        el.className = 'cal-day other-month';
        el.textContent = i;
        container.appendChild(el);
      }
    }

    function handleDayClick(date) {
      if (!isSelectingEnd) {
        // 시작일 선택
        rangeStart = date;
        rangeEnd = null;
        isSelectingEnd = true;
      } else {
        // 종료일 선택
        if (date < rangeStart) {
          // 시작일보다 이전 날짜 선택 시 → 시작일로 교체
          rangeStart = date;
          rangeEnd = null;
          isSelectingEnd = true;
        } else {
          rangeEnd = date;
          isSelectingEnd = false;
        }
      }
      renderCalendars();
      updateConfirmBtn();
    }
  }
});
