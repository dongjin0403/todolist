/**
 * TaskFlow - 할 일 관리 애플리케이션
 * Supabase 클라우드 데이터베이스 및 로컬스토리지 연동 To-Do 앱
 */

// ==========================================
// 0. Supabase 클라우드 데이터베이스 설정
// ==========================================
const SUPABASE_URL = 'https://fgdmbuzadsujawwdwdcd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FZvq6hahecRkXv21I2Pqrg_Ikz9OH3O';

let supabaseClient = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase 클라이언트 연결 성공');
  }
} catch (e) {
  console.warn('Supabase 초기화 경고:', e);
}

// DB 행(Row) 변환 헬퍼
const toDbRow = (todo) => ({
  id: String(todo.id),
  title: todo.title,
  completed: !!todo.completed,
  priority: todo.priority || 'medium',
  due_date: todo.dueDate || null,
  category_id: todo.categoryId || null,
  notes: todo.notes || '',
  created_at: todo.createdAt || Date.now(),
  user_id: state.currentUser ? state.currentUser.id : null
});

const fromDbRow = (row) => ({
  id: String(row.id),
  title: row.title,
  completed: !!row.completed,
  priority: row.priority || 'medium',
  dueDate: row.due_date || '',
  categoryId: row.category_id || 'cat-work',
  notes: row.notes || '',
  subtasks: [],
  createdAt: Number(row.created_at) || Date.now()
});

const updateSyncBadge = (isOnline, message = '클라우드 동기화됨') => {
  const badge = document.getElementById('syncBadge');
  if (!badge) return;
  if (isOnline) {
    badge.className = 'hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-200 dark:border-emerald-800';
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span><span>${message}</span>`;
  } else {
    badge.className = 'hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium border border-slate-200 dark:border-slate-700';
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span><span>${message}</span>`;
  }
};

// ==========================================
// 1. 초기 데이터 및 상태(State) 정의
// ==========================================

const DEFAULT_CATEGORIES = [
  { id: 'cat-work', name: '업무', color: 'indigo' },
  { id: 'cat-personal', name: '개인', color: 'emerald' },
  { id: 'cat-study', name: '공부', color: 'amber' },
];

const getTodayString = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const DEFAULT_TODOS = [
  {
    id: 'todo-1',
    title: '신규 기능 기획서 작성 및 리뷰',
    completed: false,
    priority: 'high',
    categoryId: 'cat-work',
    dueDate: getTodayString(0), // 오늘 마감
    notes: '팀 미팅 전까지 1차 초안 완성하고 피드백 요청하기',
    subtasks: [
      { id: 'sub-1', title: '사용자 플로우 다이어그램 작성', completed: true },
      { id: 'sub-2', title: '화면별 기능 명세 정리', completed: false }
    ],
    createdAt: Date.now() - 100000
  },
  {
    id: 'todo-2',
    title: '저녁 헬스장 하체 운동 40분',
    completed: false,
    priority: 'medium',
    categoryId: 'cat-personal',
    dueDate: getTodayString(1), // 내일
    notes: '스트레칭 충분히 하기',
    subtasks: [],
    createdAt: Date.now() - 80000
  },
  {
    id: 'todo-3',
    title: '자바스크립트 최신 문법 아티클 읽기',
    completed: false,
    priority: 'low',
    categoryId: 'cat-study',
    dueDate: getTodayString(3),
    notes: '새로운 브라우저 API 정리',
    subtasks: [],
    createdAt: Date.now() - 60000
  },
  {
    id: 'todo-4',
    title: '아침 비타민 및 영양제 챙겨먹기',
    completed: true,
    priority: 'low',
    categoryId: 'cat-personal',
    dueDate: getTodayString(0),
    notes: '',
    subtasks: [],
    createdAt: Date.now() - 120000
  },
  {
    id: 'todo-5',
    title: '주간 업무 보고서 발송',
    completed: true,
    priority: 'high',
    categoryId: 'cat-work',
    dueDate: getTodayString(0),
    notes: '주요 지표 수치 첨부 완료',
    subtasks: [],
    createdAt: Date.now() - 150000
  }
];

// 전역 상태
const getInitialTheme = () => {
  const saved = localStorage.getItem('taskflow_theme');
  if (saved && ['light', 'normal', 'dark'].includes(saved)) return saved;
  if (localStorage.getItem('taskflow_dark') === 'true') return 'dark';
  return 'normal'; // 기본값을 눈이 편안한 '노말' 모드로 설정
};

const state = {
  todos: JSON.parse(localStorage.getItem('taskflow_todos')) || [],
  categories: JSON.parse(localStorage.getItem('taskflow_categories')) || DEFAULT_CATEGORIES,
  currentView: 'all', // 'all' | 'today' | 'important' | categoryId
  statusFilter: 'all', // 'all' | 'active' | 'completed'
  sortBy: 'created_desc',
  searchQuery: '',
  isCompletedCollapsed: JSON.parse(localStorage.getItem('taskflow_completed_collapsed')) ?? false,
  selectedTodoId: null,
  theme: getInitialTheme(), // 'light' | 'normal' | 'dark'
  currentUser: null,
  authMode: 'signin' // 'signin' | 'signup'
};

// ==========================================
// 2. DOM 요소 참조
// ==========================================
const elements = {
  // 인증 컨테이너 및 폼
  authContainer: document.getElementById('authContainer'),
  mainLayout: document.getElementById('mainLayout'),
  userProfileArea: document.getElementById('userProfileArea'),
  userEmailText: document.getElementById('userEmailText'),
  logoutBtn: document.getElementById('logoutBtn'),
  headerProgressDesktop: document.getElementById('headerProgressDesktop'),
  headerSearchArea: document.getElementById('headerSearchArea'),
  headerProgressMobile: document.getElementById('headerProgressMobile'),
  tabSignInBtn: document.getElementById('tabSignInBtn'),
  tabSignUpBtn: document.getElementById('tabSignUpBtn'),
  authForm: document.getElementById('authForm'),
  authHeading: document.getElementById('authHeading'),
  authSubheading: document.getElementById('authSubheading'),
  authEmailInput: document.getElementById('authEmailInput'),
  authPasswordInput: document.getElementById('authPasswordInput'),
  passwordConfirmGroup: document.getElementById('passwordConfirmGroup'),
  authPasswordConfirmInput: document.getElementById('authPasswordConfirmInput'),
  authMessage: document.getElementById('authMessage'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),
  authSubmitText: document.getElementById('authSubmitText'),

  // 헤더
  todayDateStr: document.getElementById('todayDateStr'),
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText'),
  mobileProgressBar: document.getElementById('mobileProgressBar'),
  mobileProgressText: document.getElementById('mobileProgressText'),
  searchInput: document.getElementById('searchInput'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIcon: document.getElementById('themeIcon'),
  themeLabelText: document.getElementById('themeLabelText'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  sidebar: document.getElementById('sidebar'),
  mobileOverlay: document.getElementById('mobileOverlay'),

  // 사이드바
  navViewBtns: document.querySelectorAll('.nav-view-btn'),
  badgeCountAll: document.getElementById('badgeCountAll'),
  badgeCountToday: document.getElementById('badgeCountToday'),
  badgeCountImportant: document.getElementById('badgeCountImportant'),
  categoryList: document.getElementById('categoryList'),
  addCategoryBtn: document.getElementById('addCategoryBtn'),
  resetSampleDataBtn: document.getElementById('resetSampleDataBtn'),

  // 메인 콘텐츠
  currentViewTitle: document.getElementById('currentViewTitle'),
  currentViewSubtitle: document.getElementById('currentViewSubtitle'),
  addTodoForm: document.getElementById('addTodoForm'),
  todoTitleInput: document.getElementById('todoTitleInput'),
  todoPriorityInput: document.getElementById('todoPriorityInput'),
  todoDueDateInput: document.getElementById('todoDueDateInput'),
  todoCategoryInput: document.getElementById('todoCategoryInput'),
  statusTabBtns: document.querySelectorAll('.status-tab-btn'),
  sortSelect: document.getElementById('sortSelect'),
  activeTodoList: document.getElementById('activeTodoList'),
  emptyState: document.getElementById('emptyState'),

  // 완료 섹션 (아코디언)
  completedSection: document.getElementById('completedSection'),
  toggleCompletedBtn: document.getElementById('toggleCompletedBtn'),
  completedChevronIcon: document.getElementById('completedChevronIcon'),
  completedCountBadge: document.getElementById('completedCountBadge'),
  clearCompletedBtn: document.getElementById('clearCompletedBtn'),
  completedTodoList: document.getElementById('completedTodoList'),

  // 상세 편집 드로어
  detailDrawer: document.getElementById('detailDrawer'),
  closeDrawerBtn: document.getElementById('closeDrawerBtn'),
  drawerTitleInput: document.getElementById('drawerTitleInput'),
  drawerNoteInput: document.getElementById('drawerNoteInput'),
  drawerPrioritySelect: document.getElementById('drawerPrioritySelect'),
  drawerCategorySelect: document.getElementById('drawerCategorySelect'),
  drawerDueDateInput: document.getElementById('drawerDueDateInput'),
  drawerSubtaskCount: document.getElementById('drawerSubtaskCount'),
  drawerSubtaskList: document.getElementById('drawerSubtaskList'),
  drawerNewSubtaskInput: document.getElementById('drawerNewSubtaskInput'),
  drawerAddSubtaskBtn: document.getElementById('drawerAddSubtaskBtn'),
  drawerDeleteBtn: document.getElementById('drawerDeleteBtn'),
  drawerSaveBtn: document.getElementById('drawerSaveBtn'),

  // 카테고리 모달
  categoryModal: document.getElementById('categoryModal'),
  newCategoryNameInput: document.getElementById('newCategoryNameInput'),
  categoryColorPicker: document.getElementById('categoryColorPicker'),
  closeCategoryModalBtn: document.getElementById('closeCategoryModalBtn'),
  cancelCategoryModalBtn: document.getElementById('cancelCategoryModalBtn'),
  confirmCategoryBtn: document.getElementById('confirmCategoryBtn'),
};

// ==========================================
// 3. 유틸리티 함수
// ==========================================

const saveState = () => {
  localStorage.setItem('taskflow_todos', JSON.stringify(state.todos));
  localStorage.setItem('taskflow_categories', JSON.stringify(state.categories));
  localStorage.setItem('taskflow_completed_collapsed', JSON.stringify(state.isCompletedCollapsed));
  localStorage.setItem('taskflow_theme', state.theme);
};

const formatKoreanDate = (date = new Date()) => {
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayName = days[date.getDay()];
  return `${year}년 ${month}월 ${day}일 ${dayName}`;
};

const calculateDDay = (dueDateStr) => {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)}일 지연`, class: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800' };
  } else if (diffDays === 0) {
    return { text: '오늘 마감', class: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-bold' };
  } else if (diffDays === 1) {
    return { text: '내일 마감', class: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400' };
  } else {
    return { text: `D-${diffDays}`, class: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400' };
  }
};

const getPriorityBadge = (priority) => {
  switch (priority) {
    case 'high':
      return { label: '높음', class: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800' };
    case 'medium':
      return { label: '보통', class: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800' };
    case 'low':
      return { label: '낮음', class: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400 border border-sky-200 dark:border-sky-800' };
    default:
      return { label: '보통', class: 'bg-slate-100 text-slate-600' };
  }
};

const getCategoryColorClass = (color) => {
  const map = {
    indigo: 'bg-indigo-500 text-white',
    rose: 'bg-rose-500 text-white',
    amber: 'bg-amber-500 text-white',
    emerald: 'bg-emerald-500 text-white',
    sky: 'bg-sky-500 text-white',
    purple: 'bg-purple-500 text-white'
  };
  return map[color] || 'bg-indigo-500 text-white';
};

// ==========================================
// 4. 렌더링 함수들
// ==========================================

// 테마 동기화 (라이트 / 노말 / 다크)
const renderTheme = () => {
  const html = document.documentElement;
  html.classList.remove('dark', 'theme-normal');

  if (state.theme === 'dark') {
    html.classList.add('dark');
    elements.themeIcon.setAttribute('data-lucide', 'moon');
    elements.themeIcon.className = 'w-4 h-4 text-indigo-400';
    if (elements.themeLabelText) elements.themeLabelText.textContent = '다크 모드';
    elements.themeToggleBtn.title = '현재 테마: 다크 모드 (클릭 시 라이트 모드)';
  } else if (state.theme === 'light') {
    elements.themeIcon.setAttribute('data-lucide', 'sun');
    elements.themeIcon.className = 'w-4 h-4 text-amber-500';
    if (elements.themeLabelText) elements.themeLabelText.textContent = '라이트 모드';
    elements.themeToggleBtn.title = '현재 테마: 라이트 모드 (클릭 시 노말 모드)';
  } else {
    // normal 모드 (기본값)
    html.classList.add('theme-normal');
    elements.themeIcon.setAttribute('data-lucide', 'coffee');
    elements.themeIcon.className = 'w-4 h-4 text-amber-600';
    if (elements.themeLabelText) elements.themeLabelText.textContent = '노말 모드';
    elements.themeToggleBtn.title = '현재 테마: 노말 모드 (클릭 시 다크 모드)';
  }
  lucide.createIcons();
};

// 헤더 달성률 바 렌더링
const renderProgress = () => {
  const total = state.todos.length;
  const completed = state.todos.filter(t => t.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  const text = `${percent}% (${completed}/${total})`;
  elements.progressText.textContent = text;
  elements.mobileProgressText.textContent = text;
  elements.progressBar.style.width = `${percent}%`;
  elements.mobileProgressBar.style.width = `${percent}%`;
};

// 사이드바 뱃지 및 카테고리 렌더링
const renderSidebar = () => {
  const todayStr = getTodayString(0);
  const allCount = state.todos.length;
  const todayCount = state.todos.filter(t => t.dueDate === todayStr).length;
  const importantCount = state.todos.filter(t => t.priority === 'high').length;

  elements.badgeCountAll.textContent = allCount;
  elements.badgeCountToday.textContent = todayCount;
  elements.badgeCountImportant.textContent = importantCount;

  // 카테고리 목록 렌더링
  elements.categoryList.innerHTML = '';
  state.categories.forEach(cat => {
    const count = state.todos.filter(t => t.categoryId === cat.id).length;
    const isActive = state.currentView === cat.id;

    const btn = document.createElement('button');
    btn.dataset.category = cat.id;
    btn.className = `w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition ${
      isActive 
        ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400' 
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;

    btn.innerHTML = `
      <div class="flex items-center gap-2.5 truncate">
        <span class="w-2.5 h-2.5 rounded-full ${getCategoryColorClass(cat.color)}"></span>
        <span class="truncate">${cat.name}</span>
      </div>
      <span class="text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-indigo-100 dark:bg-indigo-900' : 'bg-slate-100 dark:bg-slate-800'} text-slate-500">${count}</span>
    `;

    btn.addEventListener('click', () => {
      state.currentView = cat.id;
      updateViewHeaders();
      renderAll();
      closeMobileSidebar();
    });

    elements.categoryList.appendChild(btn);
  });

  // 빠른 입력 및 드로어의 카테고리 셀렉트 옵션 갱신
  const populateCategorySelect = (selectElem) => {
    selectElem.innerHTML = '';
    state.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `카테고리: ${cat.name}`;
      selectElem.appendChild(opt);
    });
  };
  populateCategorySelect(elements.todoCategoryInput);
  populateCategorySelect(elements.drawerCategorySelect);
};

// 뷰 헤더 (타이틀/서브타이틀) 갱신
const updateViewHeaders = () => {
  // 사이드바 버튼 활성화 스타일
  elements.navViewBtns.forEach(btn => {
    const view = btn.dataset.view;
    if (view === state.currentView) {
      btn.className = 'nav-view-btn w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400';
    } else {
      btn.className = 'nav-view-btn w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
    }
  });

  if (state.currentView === 'all') {
    elements.currentViewTitle.innerHTML = '<i data-lucide="inbox" class="w-6 h-6 text-indigo-500"></i> 전체 할 일';
    elements.currentViewSubtitle.textContent = '등록된 모든 할 일과 마감 기한을 한눈에 관리하세요.';
  } else if (state.currentView === 'today') {
    elements.currentViewTitle.innerHTML = '<i data-lucide="sun" class="w-6 h-6 text-amber-500"></i> 오늘 할 일';
    elements.currentViewSubtitle.textContent = '오늘 마감되는 중요한 일들을 집중해서 해결하세요.';
  } else if (state.currentView === 'important') {
    elements.currentViewTitle.innerHTML = '<i data-lucide="star" class="w-6 h-6 text-rose-500"></i> 중요 (높은 우선순위)';
    elements.currentViewSubtitle.textContent = '우선순위가 가장 높은 핵심 작업들입니다.';
  } else {
    const category = state.categories.find(c => c.id === state.currentView);
    if (category) {
      elements.currentViewTitle.innerHTML = `<span class="w-3.5 h-3.5 rounded-full ${getCategoryColorClass(category.color)} inline-block"></span> ${category.name}`;
      elements.currentViewSubtitle.textContent = `'${category.name}' 카테고리에 속한 할 일 목록입니다.`;
    }
  }
};

// 할 일 카드 엘리먼트 생성
const createTodoCardElement = (todo) => {
  const category = state.categories.find(c => c.id === todo.categoryId);
  const priorityBadge = getPriorityBadge(todo.priority);
  const dday = calculateDDay(todo.dueDate);

  const card = document.createElement('div');
  card.className = `task-card-enter group flex items-start sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-800 border transition hover:shadow-md cursor-pointer ${
    todo.completed 
      ? 'border-slate-200/60 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-900/40 opacity-75' 
      : 'border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-500/50'
  }`;

  // 카드 클릭 시 드로어 오픈 (체크박스/버튼 클릭 제외)
  card.addEventListener('click', (e) => {
    if (e.target.closest('input[type="checkbox"]') || e.target.closest('button')) return;
    openDetailDrawer(todo.id);
  });

  // 서브태스크 카운트
  const totalSubtasks = todo.subtasks?.length || 0;
  const completedSubtasks = todo.subtasks?.filter(s => s.completed).length || 0;
  const hasNotes = !!todo.notes;

  card.innerHTML = `
    <div class="flex items-start sm:items-center gap-3 flex-1 min-w-0">
      <!-- 완료 체크박스 -->
      <div class="pt-0.5 sm:pt-0">
        <input 
          type="checkbox" 
          ${todo.completed ? 'checked' : ''} 
          class="custom-checkbox"
          title="${todo.completed ? '다시 진행 중으로 변경' : '완료 표시'}"
        >
      </div>

      <!-- 내용 및 메타 정보 -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-medium ${todo.completed ? 'completed-text text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'} break-words">
            ${escapeHtml(todo.title)}
          </span>
        </div>

        <!-- 뱃지 목록 (마감일, 우선순위, 카테고리, 서브태스크, 메모) -->
        <div class="flex flex-wrap items-center gap-1.5 mt-1 text-[11px]">
          <!-- 우선순위 배지 -->
          <span class="px-2 py-0.5 rounded-md font-medium ${priorityBadge.class}">
            ${priorityBadge.label}
          </span>

          <!-- 마감일 D-Day 배지 -->
          ${dday ? `
            <span class="px-2 py-0.5 rounded-md font-medium flex items-center gap-1 ${dday.class}">
              <i data-lucide="clock" class="w-3 h-3"></i>
              ${dday.text}
            </span>
          ` : ''}

          <!-- 카테고리 배지 -->
          ${category ? `
            <span class="px-2 py-0.5 rounded-md font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
              #${category.name}
            </span>
          ` : ''}

          <!-- 메모 아이콘 -->
          ${hasNotes ? `
            <span class="text-slate-400 dark:text-slate-500 flex items-center gap-0.5" title="메모 있음">
              <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
            </span>
          ` : ''}

          <!-- 서브태스크 진행률 배지 -->
          ${totalSubtasks > 0 ? `
            <span class="px-1.5 py-0.5 rounded-md font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
              <i data-lucide="check-circle-2" class="w-3 h-3 text-indigo-500"></i>
              ${completedSubtasks}/${totalSubtasks}
            </span>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- 우측 호버 액션 버튼 -->
    <div class="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
      <button class="edit-todo-btn p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition" title="상세 편집">
        <i data-lucide="more-horizontal" class="w-4 h-4"></i>
      </button>
      <button class="delete-todo-btn p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition" title="삭제">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>
  `;

  // 체크박스 이벤트 (완료 <-> 미완료 토글)
  const checkbox = card.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', (e) => {
    e.stopPropagation();
    toggleTodoCompletion(todo.id);
  });

  // 편집 버튼
  const editBtn = card.querySelector('.edit-todo-btn');
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openDetailDrawer(todo.id);
  });

  // 삭제 버튼
  const deleteBtn = card.querySelector('.delete-todo-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTodo(todo.id);
  });

  return card;
};

// 메인 할 일 목록 렌더링
const renderTodoList = () => {
  const todayStr = getTodayString(0);

  // 1. 뷰 필터링
  let filtered = state.todos.filter(todo => {
    // 뷰별 조건
    if (state.currentView === 'today' && todo.dueDate !== todayStr) return false;
    if (state.currentView === 'important' && todo.priority !== 'high') return false;
    if (state.currentView.startsWith('cat-') && todo.categoryId !== state.currentView) return false;

    // 검색어 필터링
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      const matchTitle = todo.title.toLowerCase().includes(q);
      const matchNotes = todo.notes?.toLowerCase().includes(q);
      if (!matchTitle && !matchNotes) return false;
    }

    return true;
  });

  // 2. 정렬 적용
  filtered.sort((a, b) => {
    if (state.sortBy === 'created_desc') return b.createdAt - a.createdAt;
    if (state.sortBy === 'title_asc') return a.title.localeCompare(b.title);
    if (state.sortBy === 'priority_desc') {
      const pWeights = { high: 3, medium: 2, low: 1 };
      return (pWeights[b.priority] || 0) - (pWeights[a.priority] || 0);
    }
    if (state.sortBy === 'due_asc') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    return 0;
  });

  // 3. 진행 중 목록 vs 완료된 목록 분리
  const activeTodos = filtered.filter(t => !t.completed);
  const completedTodos = filtered.filter(t => t.completed);

  // 활성 태스크 목록 렌더링
  elements.activeTodoList.innerHTML = '';
  if (state.statusFilter !== 'completed') {
    activeTodos.forEach(todo => {
      elements.activeTodoList.appendChild(createTodoCardElement(todo));
    });
  }

  // 빈 상태(Empty state) 처리
  const isViewEmpty = (state.statusFilter === 'active' && activeTodos.length === 0) ||
                      (state.statusFilter === 'completed' && completedTodos.length === 0) ||
                      (state.statusFilter === 'all' && activeTodos.length === 0 && completedTodos.length === 0);

  elements.emptyState.classList.toggle('hidden', !isViewEmpty);

  // 4. 완료된 항목 섹션 (아코디언) 처리
  elements.completedCountBadge.textContent = completedTodos.length;
  elements.completedTodoList.innerHTML = '';

  if (completedTodos.length > 0 && state.statusFilter !== 'active') {
    elements.completedSection.classList.remove('hidden');
    completedTodos.forEach(todo => {
      elements.completedTodoList.appendChild(createTodoCardElement(todo));
    });

    // 접기/펼치기 아코디언 상태 반영
    if (state.isCompletedCollapsed) {
      elements.completedTodoList.classList.add('accordion-collapsed');
      elements.completedChevronIcon.classList.add('-rotate-90');
    } else {
      elements.completedTodoList.classList.remove('accordion-collapsed');
      elements.completedChevronIcon.classList.remove('-rotate-90');
    }
  } else {
    // 완료된 항목이 없거나 '진행 중' 탭일 때는 숨김
    elements.completedSection.classList.add('hidden');
  }

  lucide.createIcons();
};

const renderAll = () => {
  renderTheme();
  renderProgress();
  renderSidebar();
  renderTodoList();
  saveState();
};

// ==========================================
// 4.1 인증 UI 관리 및 모드 전환
// ==========================================

const showAuthMessage = (text, isError = true) => {
  if (!elements.authMessage) return;
  elements.authMessage.textContent = text;
  elements.authMessage.className = `p-3 rounded-xl text-xs font-medium ${
    isError 
      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800' 
      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
  }`;
  elements.authMessage.classList.remove('hidden');
};

const clearAuthMessage = () => {
  if (elements.authMessage) elements.authMessage.classList.add('hidden');
};

const switchAuthMode = (mode) => {
  state.authMode = mode;
  clearAuthMessage();

  if (mode === 'signup') {
    elements.tabSignUpBtn.className = 'py-2.5 rounded-xl bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm transition font-bold';
    elements.tabSignInBtn.className = 'py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
    elements.authHeading.textContent = 'TaskFlow 회원가입';
    elements.authSubheading.textContent = '이메일과 비밀번호로 간편하게 가입하세요.';
    elements.authSubmitText.textContent = '회원가입 완료';
    elements.passwordConfirmGroup.classList.remove('hidden');
    elements.authPasswordConfirmInput.required = true;
  } else {
    elements.tabSignInBtn.className = 'py-2.5 rounded-xl bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm transition font-bold';
    elements.tabSignUpBtn.className = 'py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
    elements.authHeading.textContent = 'TaskFlow 로그인';
    elements.authSubheading.textContent = '나만의 안전한 클라우드 할 일 목록을 시작하세요.';
    elements.authSubmitText.textContent = '로그인하기';
    elements.passwordConfirmGroup.classList.add('hidden');
    elements.authPasswordConfirmInput.required = false;
  }
};

const updateAuthUI = (user) => {
  state.currentUser = user || null;

  if (state.currentUser) {
    elements.authContainer.classList.add('hidden');
    elements.mainLayout.classList.remove('hidden');
    elements.userProfileArea.classList.remove('hidden');
    elements.userEmailText.textContent = state.currentUser.email || '';
    if (elements.headerProgressDesktop) elements.headerProgressDesktop.classList.remove('hidden');
    if (elements.headerSearchArea) elements.headerSearchArea.classList.remove('hidden');
    if (elements.headerProgressMobile) elements.headerProgressMobile.classList.remove('hidden');
  } else {
    elements.authContainer.classList.remove('hidden');
    elements.mainLayout.classList.add('hidden');
    elements.userProfileArea.classList.add('hidden');
    if (elements.headerProgressDesktop) elements.headerProgressDesktop.classList.add('hidden');
    if (elements.headerSearchArea) elements.headerSearchArea.classList.add('hidden');
    if (elements.headerProgressMobile) elements.headerProgressMobile.classList.add('hidden');
  }
  lucide.createIcons();
};

// ==========================================
// 5. 기능 액션 (CRUD, 토글, 상태 변경) & Supabase 동기화
// ==========================================

// Supabase 데이터 불러오기 (로그인된 본인 데이터만 RLS로 안전하게 조회)
const fetchTodosFromSupabase = async () => {
  if (!supabaseClient || !state.currentUser) {
    updateSyncBadge(false, '로그인 필요');
    return;
  }

  updateSyncBadge(true, '동기화 중...');
  try {
    const { data, error } = await supabaseClient
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase 데이터 조회 안내:', error.message);
      updateSyncBadge(false, '동기화 오류');
      return;
    }

    state.todos = (data || []).map(fromDbRow);
    renderAll();
    updateSyncBadge(true, '클라우드 동기화됨');
  } catch (err) {
    console.warn('Supabase 통신 오류:', err);
    updateSyncBadge(false, '오프라인');
  }
};

// 할 일 추가
const addTodo = async (title, priority, dueDate, categoryId) => {
  if (!title.trim()) return;

  const newTodo = {
    id: 'todo-' + Date.now(),
    title: title.trim(),
    completed: false,
    priority: priority || 'medium',
    dueDate: dueDate || '',
    categoryId: categoryId || state.categories[0]?.id || 'cat-work',
    notes: '',
    subtasks: [],
    createdAt: Date.now()
  };

  // 1. 로컬에 즉시 반영 (빠른 UX)
  state.todos.unshift(newTodo);
  renderAll();

  // 2. Supabase 클라우드 동기화
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.from('todos').insert([toDbRow(newTodo)]);
      if (error) console.warn('Supabase 저장 실패:', error.message);
    } catch (err) {
      console.warn('Supabase 통신 실패:', err);
    }
  }
};

// 완료 상태 토글 (진행 중 <-> 완료)
const toggleTodoCompletion = async (todoId) => {
  const target = state.todos.find(t => t.id === todoId);
  if (!target) return;

  target.completed = !target.completed;
  
  // 완료로 변경되었을 때, 만약 완료 아코디언이 닫혀있다면 사용자가 확인할 수 있도록 자동으로 펼쳐줌
  if (target.completed && state.isCompletedCollapsed) {
    state.isCompletedCollapsed = false;
  }

  // 1. 로컬에 즉시 반영
  renderAll();

  // 2. Supabase 클라우드 동기화
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('todos')
        .update({ completed: target.completed })
        .eq('id', String(todoId));
      if (error) console.warn('Supabase 완료 상태 갱신 실패:', error.message);
    } catch (err) {
      console.warn('Supabase 통신 실패:', err);
    }
  }
};

// 할 일 삭제
const deleteTodo = async (todoId) => {
  state.todos = state.todos.filter(t => t.id !== todoId);
  if (state.selectedTodoId === todoId) {
    closeDetailDrawer();
  }

  // 1. 로컬 반영
  renderAll();

  // 2. Supabase 동기화
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('todos')
        .delete()
        .eq('id', String(todoId));
      if (error) console.warn('Supabase 삭제 실패:', error.message);
    } catch (err) {
      console.warn('Supabase 통신 실패:', err);
    }
  }
};

// 완료 목록 전체 삭제
const clearCompletedTodos = async () => {
  const count = state.todos.filter(t => t.completed).length;
  if (count === 0) return;

  if (confirm(`완료된 ${count}개의 할 일을 모두 삭제하시겠습니까?`)) {
    state.todos = state.todos.filter(t => !t.completed);
    renderAll();

    if (supabaseClient) {
      try {
        await supabaseClient.from('todos').delete().eq('completed', true);
      } catch (err) {
        console.warn('Supabase 일괄 삭제 오류:', err);
      }
    }
  }
};

// ==========================================
// 6. 상세 드로어 (Detail Drawer) 로직
// ==========================================

const openDetailDrawer = (todoId) => {
  const todo = state.todos.find(t => t.id === todoId);
  if (!todo) return;

  state.selectedTodoId = todoId;
  elements.drawerTitleInput.value = todo.title;
  elements.drawerNoteInput.value = todo.notes || '';
  elements.drawerPrioritySelect.value = todo.priority;
  elements.drawerCategorySelect.value = todo.categoryId;
  elements.drawerDueDateInput.value = todo.dueDate || '';

  renderDrawerSubtasks(todo);

  elements.detailDrawer.classList.remove('translate-x-full');
  elements.mobileOverlay.classList.remove('hidden');
};

const closeDetailDrawer = () => {
  elements.detailDrawer.classList.add('translate-x-full');
  elements.mobileOverlay.classList.add('hidden');
  state.selectedTodoId = null;
};

const renderDrawerSubtasks = (todo) => {
  elements.drawerSubtaskList.innerHTML = '';
  const subtasks = todo.subtasks || [];
  const completed = subtasks.filter(s => s.completed).length;
  elements.drawerSubtaskCount.textContent = `${completed}/${subtasks.length}`;

  subtasks.forEach((sub, idx) => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs';
    item.innerHTML = `
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <input type="checkbox" ${sub.completed ? 'checked' : ''} class="custom-checkbox w-4 h-4">
        <span class="${sub.completed ? 'completed-text text-slate-400' : 'text-slate-800 dark:text-slate-200'} truncate">${escapeHtml(sub.title)}</span>
      </div>
      <button class="delete-subtask-btn text-slate-400 hover:text-rose-500">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
      </button>
    `;

    const chk = item.querySelector('input[type="checkbox"]');
    chk.addEventListener('change', () => {
      sub.completed = chk.checked;
      renderDrawerSubtasks(todo);
      renderAll();
    });

    const del = item.querySelector('.delete-subtask-btn');
    del.addEventListener('click', () => {
      todo.subtasks.splice(idx, 1);
      renderDrawerSubtasks(todo);
      renderAll();
    });

    elements.drawerSubtaskList.appendChild(item);
  });

  lucide.createIcons();
};

const saveDrawerChanges = async () => {
  if (!state.selectedTodoId) return;
  const todo = state.todos.find(t => t.id === state.selectedTodoId);
  if (!todo) return;

  const newTitle = elements.drawerTitleInput.value.trim();
  if (newTitle) todo.title = newTitle;
  todo.notes = elements.drawerNoteInput.value.trim();
  todo.priority = elements.drawerPrioritySelect.value;
  todo.categoryId = elements.drawerCategorySelect.value;
  todo.dueDate = elements.drawerDueDateInput.value;

  closeDetailDrawer();
  renderAll();

  // Supabase 동기화
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('todos')
        .update(toDbRow(todo))
        .eq('id', String(todo.id));
      if (error) console.warn('Supabase 상세 수정 반영 실패:', error.message);
    } catch (err) {
      console.warn('Supabase 통신 오류:', err);
    }
  }
};

// ==========================================
// 7. 모바일 메뉴 & 모달 제어
// ==========================================

const openMobileSidebar = () => {
  elements.sidebar.classList.remove('-translate-x-full');
  elements.mobileOverlay.classList.remove('hidden');
};

const closeMobileSidebar = () => {
  elements.sidebar.classList.add('-translate-x-full');
  elements.mobileOverlay.classList.add('hidden');
};

let selectedColor = 'indigo';

const openCategoryModal = () => {
  elements.newCategoryNameInput.value = '';
  elements.categoryModal.classList.remove('hidden');
  elements.newCategoryNameInput.focus();
};

const closeCategoryModal = () => {
  elements.categoryModal.classList.add('hidden');
};

// ==========================================
// 8. 헬퍼 및 이벤트 리스너 등록
// ==========================================

const escapeHtml = (unsafe) => {
  return (unsafe || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const initEventListeners = () => {
  // 오늘 날짜 텍스트 세팅
  elements.todayDateStr.textContent = formatKoreanDate();

  // 기본 마감일을 오늘로 세팅
  elements.todoDueDateInput.value = getTodayString(0);

  // 테마 토글: 라이트 -> 노말 -> 다크 -> 라이트 순환
  elements.themeToggleBtn.addEventListener('click', () => {
    if (state.theme === 'light') {
      state.theme = 'normal';
    } else if (state.theme === 'normal') {
      state.theme = 'dark';
    } else {
      state.theme = 'light';
    }
    renderTheme();
    saveState();
  });

  // 검색 인풋
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderTodoList();
  });

  // 모바일 메뉴 제어
  elements.mobileMenuBtn.addEventListener('click', openMobileSidebar);
  elements.closeSidebarBtn.addEventListener('click', closeMobileSidebar);
  elements.mobileOverlay.addEventListener('click', () => {
    closeMobileSidebar();
    closeDetailDrawer();
  });

  // 사이드바 기본 뷰 클릭
  elements.navViewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentView = btn.dataset.view;
      updateViewHeaders();
      renderAll();
      closeMobileSidebar();
    });
  });

  // 빠른 할 일 등록 폼 제출
  elements.addTodoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = elements.todoTitleInput.value;
    const priority = elements.todoPriorityInput.value;
    const dueDate = elements.todoDueDateInput.value;
    const categoryId = elements.todoCategoryInput.value;

    addTodo(title, priority, dueDate, categoryId);
    elements.todoTitleInput.value = '';
    elements.todoTitleInput.focus();
  });

  // 상태 필터 탭 (전체 / 진행 중 / 완료됨)
  elements.statusTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.statusTabBtns.forEach(b => {
        b.className = 'status-tab-btn px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
      });
      btn.className = 'status-tab-btn px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm transition font-bold';

      state.statusFilter = btn.dataset.status;
      renderTodoList();
    });
  });

  // 정렬 셀렉트 변경
  elements.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderTodoList();
  });

  // [핵심] 완료된 항목 섹션 아코디언 토글
  elements.toggleCompletedBtn.addEventListener('click', () => {
    state.isCompletedCollapsed = !state.isCompletedCollapsed;
    renderTodoList();
    saveState();
  });

  // 완료 목록 비우기
  elements.clearCompletedBtn.addEventListener('click', clearCompletedTodos);

  // 샘플 데이터 복원
  elements.resetSampleDataBtn.addEventListener('click', () => {
    if (confirm('샘플 데이터로 초기화하시겠습니까? (현재 작성된 모든 데이터가 교체됩니다)')) {
      state.todos = [...DEFAULT_TODOS];
      state.categories = [...DEFAULT_CATEGORIES];
      renderAll();
    }
  });

  // 드로어 닫기 및 저장
  elements.closeDrawerBtn.addEventListener('click', closeDetailDrawer);
  elements.drawerSaveBtn.addEventListener('click', saveDrawerChanges);
  elements.drawerDeleteBtn.addEventListener('click', () => {
    if (state.selectedTodoId && confirm('이 할 일을 삭제하시겠습니까?')) {
      deleteTodo(state.selectedTodoId);
    }
  });

  // 드로어 하위 태스크 추가
  const addSubtaskFromDrawer = () => {
    const text = elements.drawerNewSubtaskInput.value.trim();
    if (!text || !state.selectedTodoId) return;
    const todo = state.todos.find(t => t.id === state.selectedTodoId);
    if (!todo) return;

    if (!todo.subtasks) todo.subtasks = [];
    todo.subtasks.push({
      id: 'sub-' + Date.now(),
      title: text,
      completed: false
    });

    elements.drawerNewSubtaskInput.value = '';
    renderDrawerSubtasks(todo);
    renderAll();
  };

  elements.drawerAddSubtaskBtn.addEventListener('click', addSubtaskFromDrawer);
  elements.drawerNewSubtaskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSubtaskFromDrawer();
    }
  });

  // 카테고리 모달 관련 이벤트
  elements.addCategoryBtn.addEventListener('click', openCategoryModal);
  elements.closeCategoryModalBtn.addEventListener('click', closeCategoryModal);
  elements.cancelCategoryModalBtn.addEventListener('click', closeCategoryModal);

  elements.categoryColorPicker.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.categoryColorPicker.querySelectorAll('button').forEach(b => {
        b.classList.remove('ring-2', 'ring-offset-2', 'ring-indigo-500');
      });
      btn.classList.add('ring-2', 'ring-offset-2', 'ring-indigo-500');
      selectedColor = btn.dataset.color;
    });
  });

  elements.confirmCategoryBtn.addEventListener('click', () => {
    const name = elements.newCategoryNameInput.value.trim();
    if (!name) return;

    const newCat = {
      id: 'cat-' + Date.now(),
      name: name,
      color: selectedColor
    };
    state.categories.push(newCat);
    closeCategoryModal();
    renderAll();
  });
  // ==========================================
  // 인증 관련 이벤트 리스너 (회원가입 / 로그인 / 로그아웃)
  // ==========================================
  if (elements.tabSignInBtn) {
    elements.tabSignInBtn.addEventListener('click', () => switchAuthMode('signin'));
  }
  if (elements.tabSignUpBtn) {
    elements.tabSignUpBtn.addEventListener('click', () => switchAuthMode('signup'));
  }

  if (elements.authForm) {
    elements.authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!supabaseClient) {
        showAuthMessage('Supabase 연결 상태를 확인할 수 없습니다.', true);
        return;
      }

      const email = elements.authEmailInput.value.trim();
      const password = elements.authPasswordInput.value;

      if (!email || !password) {
        showAuthMessage('이메일과 비밀번호를 입력해 주세요.', true);
        return;
      }

      if (state.authMode === 'signup') {
        const passwordConfirm = elements.authPasswordConfirmInput.value;
        if (password !== passwordConfirm) {
          showAuthMessage('비밀번호가 서로 일치하지 않습니다.', true);
          return;
        }
      }

      elements.authSubmitBtn.disabled = true;
      elements.authSubmitText.textContent = state.authMode === 'signup' ? '가입 처리 중...' : '로그인 중...';
      clearAuthMessage();

      try {
        if (state.authMode === 'signup') {
          const { data, error } = await supabaseClient.auth.signUp({
            email,
            password
          });
          if (error) {
            showAuthMessage(error.message, true);
          } else {
            if (data.session) {
              showAuthMessage('회원가입 성공! 로그인되었습니다.', false);
              updateAuthUI(data.session.user);
              fetchTodosFromSupabase();
            } else {
              showAuthMessage('회원가입 완료! 로그인해 주세요.', false);
              switchAuthMode('signin');
            }
          }
        } else {
          const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
          });
          if (error) {
            showAuthMessage(
              error.message === 'Invalid login credentials' 
                ? '이메일 또는 비밀번호가 올바르지 않습니다.' 
                : error.message, 
              true
            );
          } else {
            updateAuthUI(data.user);
            fetchTodosFromSupabase();
          }
        }
      } catch (err) {
        showAuthMessage('인증 요청 중 오류가 발생했습니다: ' + err.message, true);
      } finally {
        elements.authSubmitBtn.disabled = false;
        elements.authSubmitText.textContent = state.authMode === 'signup' ? '회원가입 완료' : '로그인하기';
      }
    });
  }

  // 로그아웃
  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', async () => {
      if (confirm('로그아웃 하시겠습니까?')) {
        if (supabaseClient) {
          await supabaseClient.auth.signOut();
        }
        state.currentUser = null;
        state.todos = [];
        updateAuthUI(null);
        renderAll();
      }
    });
  }
};

// ==========================================
// 9. 앱 초기 실행 및 세션 복원
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  initEventListeners();
  updateViewHeaders();
  renderAll();

  // Supabase 세션 확인 및 상태 감지
  if (supabaseClient) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user) {
        updateAuthUI(session.user);
        fetchTodosFromSupabase();
      } else {
        updateAuthUI(null);
      }

      // 로그인/로그아웃 실시간 상태 감지
      supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          updateAuthUI(session.user);
          fetchTodosFromSupabase();
        } else {
          updateAuthUI(null);
          state.todos = [];
          renderAll();
        }
      });
    } catch (e) {
      console.warn('세션 확인 오류:', e);
      updateAuthUI(null);
    }
  } else {
    updateAuthUI(null);
  }
});

