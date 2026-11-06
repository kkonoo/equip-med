// 공동기기@KNUmed (equip-med) — 두 페이지(index.html, admin.html)가 같이 쓰는 부분
// 상태(S), 로그인 상태에 따른 화면 전환(gate), 시간 도우미(Asia/Seoul), toast, 테마·글씨 크기, 설정 창
// 데이터는 전부 Firestore에 있고 sync.js가 S에 채운 뒤 onAuth()·onData()를 불러요.
const $ = id => document.getElementById(id);
const PAGE = document.body.dataset.page; // 'user' | 'admin'
const PKEY = 'equip-med-prefs';

const readJSON = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
let prefs = { theme: 'auto', fs: 1, ...readJSON(PKEY) };
const savePrefs = () => { try { localStorage.setItem(PKEY, JSON.stringify(prefs)); } catch { /* 저장 못 해도 화면은 그대로 */ } };

// sync.js가 채움. 시간은 전부 ms 숫자(Timestamp → toMillis)
const S = {
  user: null,        // Firebase 로그인 사용자
  me: null,          // users/{uid} 문서 (없으면 null)
  meLoaded: false,
  labs: [],          // labs (order 순)
  equipment: [],     // equipment (order 순) — 승인된 사용자만 받음
  equipLoaded: false,
};

// ---------- 시간 (Asia/Seoul = UTC+9, 서머타임 없음) ----------
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR, KST = 9 * HOUR;
const DOW = LANG === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : [...'일월화수목금토'];
const pad = n => String(n).padStart(2, '0');
function kp(ms) { // 서울 시각으로 나눈 값
  const d = new Date(ms + KST);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), dow: d.getUTCDay() };
}
const kms = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) - KST;
const dayStart = ms => { const p = kp(ms); return kms(p.y, p.m, p.d); };
const weekStart = ms => { const s = dayStart(ms); return s - ((kp(s).dow + 6) % 7) * DAY; }; // 월요일
const monthStart = ms => { const p = kp(ms); return kms(p.y, p.m, 1); };
const ymd = ms => { const p = kp(ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
const hm = ms => { const p = kp(ms); return `${pad(p.h)}:${pad(p.mi)}`; };
const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); }; // 'HH:MM' → 분
const fromInput = (date, time = '00:00') => { const [y, m, d] = date.split('-').map(Number); return kms(y, m, d) + toMin(time) * MIN; };
const toLocalInput = ms => (ms == null ? '' : `${ymd(ms)}T${hm(ms)}`); // <input type="datetime-local">
const fromLocalInput = v => (v ? fromInput(...v.split('T')) : null);
function fmtDay(ms) { const p = kp(ms); return `${p.m}/${p.d} (${DOW[p.dow]})`; }
function fmtRange(s, e) {
  if (e === dayStart(s) + DAY) return `${fmtDay(s)} ${hm(s)}–24:00`;
  return dayStart(s) === dayStart(e) ? `${fmtDay(s)} ${hm(s)}–${hm(e)}` : `${fmtDay(s)} ${hm(s)} – ${fmtDay(e)} ${hm(e)}`;
}

// ---------- 공통 도우미 ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labName = id => S.labs.find(l => l.id === id)?.name || '';
const equipById = id => S.equipment.find(e => e.id === id);
const isAdmin = () => S.me?.role === 'admin' && S.me?.active !== false;
const manages = e => isAdmin() || (e.managers || []).includes(S.user?.uid);
const myEquip = () => S.equipment.filter(e => (e.managers || []).includes(S.user?.uid)); // 내가 담당자로 지정된 기기
const canAdmin = () => isAdmin() || myEquip().length > 0;
const STATUS = { ok: t('정상'), maintenance: t('점검'), broken: t('고장') };
const BOOK_STATUS = { pending: t('승인 대기'), approved: t('승인'), rejected: t('거절'), cancelled: t('취소') };

// 기기의 지금 상태: 점검·고장이면 막힌 기간 [지금, statusUntil) (끝이 없으면 계속)
function downUntil(e) { return e.status && e.status !== 'ok' ? (e.statusUntil ?? Infinity) : null; }
// 예약 규칙: slotMinutes만 기본값 30분, 나머지는 비어 있으면 제한 없음
const rulesOf = e => ({ slotMinutes: 30, maxHours: null, maxDaysAhead: null, openFrom: null, openTo: null, ...e?.rules });
function ruleList(e) {
  const r = rulesOf(e);
  return [
    t('예약 단위 {n}분', { n: r.slotMinutes }),
    r.maxHours ? t('1회 최대 {n}시간', { n: r.maxHours }) : t('1회 시간 제한 없음'),
    r.maxDaysAhead != null ? t('오늘부터 {n}일 뒤까지 예약', { n: r.maxDaysAhead }) : t('며칠 앞이든 예약'),
    r.openFrom && r.openTo ? t('예약 가능 {from}–{to}', { from: r.openFrom, to: r.openTo }) : t('하루 종일 예약 가능'),
    e.requiresApproval === false ? t('예약하면 바로 확정') : t('담당자 승인 뒤 확정'),
  ];
}
const managerNames = e => (e.managers || []).map(uid => e.managerNames?.[uid] || t('이름 없음'));
function statusChip(e) { const s = e.status || 'ok'; return `<span class="chip ${s}">${STATUS[s]}</span>`; }
function statusLine(e) { // 점검·고장일 때 사유와 기간
  if (!e.status || e.status === 'ok') return '';
  const until = e.statusUntil ? ` · ${t('{when}까지', { when: `${fmtDay(e.statusUntil)} ${hm(e.statusUntil)}` })}` : '';
  return `${STATUS[e.status]}${e.statusNote ? ` · ${e.statusNote}` : ''}${until}`;
}
const safeUrl = u => (/^https?:\/\//i.test(u || '') ? u : null);

let toastTimer;
function toast(text, ms = 2200) {
  const t = $('toast');
  t.textContent = text;
  // popover = 맨 위 층: 열린 대화상자(dialog)보다 위에 보이게 다시 띄움
  try { t.hidePopover(); t.showPopover(); } catch { /* popover 없는 브라우저: 그냥 아래에 보임 */ }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
// 저장 실패 등: 무엇이 안 됐는지 + 원인 코드
function fail(what, e) {
  console.error(what, e);
  toast(e?.code === 'permission-denied' ? t('{what}: 권한이 없어요', { what }) : `${what}: ${e?.message || e}`, 3500);
}

// ---------- 테마·글씨 크기 ----------
function applyTheme() {
  const r = document.documentElement;
  if (prefs.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = prefs.theme;
  r.style.setProperty('--fs', prefs.fs);
  $('themeColor')?.setAttribute('content', getComputedStyle(r).getPropertyValue('--bg').trim());
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ---------- 화면 전환: 로그인 상태 → gate 또는 앱 ----------
let shown = null; // 지금 보이는 gate 이름 또는 'app'
function onAuth() {
  showAccount();
  if (!S.user) return gate('login');
  if (!S.meLoaded) return gate('loading');
  if (!S.me) return gate('signup');
  if (S.me.active === false) return gate('inactive');
  if (S.me.role === 'pending') return gate('pending');
  if (!S.equipLoaded) return gate('loading');
  if (PAGE === 'admin' && !canAdmin()) return gate('forbidden');
  showApp();
}
function onData() { // sync.js: 기기·연구실 목록이 바뀜
  if (shown === 'app' && PAGE === 'admin' && !canAdmin()) return onAuth();
  if (shown === 'app') render(); else onAuth();
}
function showApp() {
  $('gate').hidden = true;
  $('app').hidden = false;
  document.body.classList.add('in-app');
  if (shown !== 'app') { shown = 'app'; if (window.appStart) return window.appStart(); }
  render();
}
// ---------- 담당자·총관리자용 실시간 목록 (관리자 페이지 + 사용자 화면의 배지) ----------
const A = { upcoming: [], users: [], upKey: '', offUp: null, offUsers: null, since: 0 };
function adminFeeds() {
  if (!canAdmin()) return;
  const ids = isAdmin() ? null : myEquip().map(e => e.id);
  const key = ids ? ids.join(',') : '*';
  if (A.upKey !== key) { // 담당 기기가 바뀌면 다시 구독
    A.offUp?.();
    A.upKey = key; A.upcoming = []; A.since = Date.now();
    A.offUp = window.cloud.watchUpcoming(ids, A.since, list => { A.upcoming = list; render(); });
  }
  if (isAdmin() && !A.offUsers) A.offUsers = window.cloud.watchUsers(list => { A.users = list; render(); });
}
const pendingBookings = () => A.upcoming.filter(b => b.status === 'pending');
const pendingUsers = () => A.users.filter(u => u.role === 'pending');
// 로그아웃·계정 바뀜: sync.js가 구독을 모두 끊은 뒤 부름 → 각 화면 파일이 넣어 둔 함수로 상태를 처음으로
const resets = [];
window.resetFeeds = () => resets.forEach(f => f());
resets.push(() => Object.assign(A, { upcoming: [], users: [], upKey: '', offUp: null, offUsers: null }));

// 지금 탭(페이지)을 데이터로 다시 그리기 — 각 화면 파일의 render 함수
function render() {
  if (shown !== 'app') return;
  adminFeeds();
  showAccount();
  if (PAGE === 'admin') return window.renderAdmin?.();
  ({ book: window.renderBooking, mine: window.renderMine, equip: window.renderEquipment })[prefs.tab]?.();
}

const GATES = {
  loading: () => `<p class="hint">${t('불러오는 중이에요…')}</p>`,
  setup: () => `
    <h2>${t('설정이 필요해요')}</h2>
    <p>${t('아직 Firebase 프로젝트가 연결되지 않았어요.')}</p>
    <ol class="steps">
      <li>${t('Firebase 콘솔에서 프로젝트를 만들고 Authentication(Google)과 Firestore를 켜요.')}</li>
      <li>${esc(t('프로젝트 설정 > 내 앱(웹)의 firebaseConfig 값을 js/firebase-config.js에 넣어요.'))}</li>
      <li>${t('firestore.rules를 Firestore 규칙에 붙여 넣어요.')}</li>
    </ol>
    <p class="hint">${t("자세한 순서는 README의 '처음 쓸 때'에 있어요.")}</p>`,
  error: () => `
    <h2>${t('연결하지 못했어요')}</h2>
    <p>${t('Firebase를 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고침해 주세요.')}</p>
    <button class="btn" onclick="location.reload()">${t('새로 고침')}</button>`,
  login: () => `
    <h2>${t('공동기기')}@KNUmed</h2>
    <p>${t('연구실이 같이 쓰는 기기를 예약하고 매뉴얼을 볼 수 있어요.')}<br>${t('Google 계정으로 로그인해 주세요.')}</p>
    <button class="btn primary" id="gateLogin">${t('Google로 로그인')}</button>
    ${langSeg()}`,
  signup: () => `
    <h2>${t('가입 신청')}</h2>
    <p>${t('처음 오셨네요. 이름과 소속 연구실을 적어 주세요. 총관리자가 승인하면 쓸 수 있어요.')}</p>
    <form id="signupForm" class="form">
      <label>${t('이름')}<input name="name" required maxlength="40" autocomplete="name"></label>
      <label>${t('연구실')}
        <select name="lab" required>${labOptions()}</select>
      </label>
      <label id="labOtherRow" hidden>${t('연구실 이름')}<input name="labOther" maxlength="60" placeholder="${t('예: 분자생물학 연구실')}"></label>
      <p class="hint">${t('{email} 계정으로 신청해요.', { email: esc(S.user?.email || '') })}</p>
      <div class="actions"><button type="button" class="btn" id="gateLogout">${t('로그아웃')}</button><button class="btn primary">${t('신청')}</button></div>
    </form>
    ${langSeg()}`,
  pending: () => `
    <h2>${t('승인 대기 중이에요')}</h2>
    <p>${t('가입 신청을 보냈어요. 총관리자가 승인하면 바로 쓸 수 있어요.')}</p>
    <dl class="kv">
      <dt>${t('이름')}</dt><dd>${esc(S.me?.name)}</dd>
      <dt>${t('연구실')}</dt><dd>${esc(labName(S.me?.labId) || S.me?.labName)}</dd>
      <dt>${t('계정')}</dt><dd>${esc(S.me?.email)}</dd>
    </dl>
    <button class="btn" id="gateLogout">${t('로그아웃')}</button>`,
  inactive: () => `
    <h2>${t('이용이 중지된 계정이에요')}</h2>
    <p>${t('총관리자에게 문의해 주세요.')}</p>
    <button class="btn" id="gateLogout">${t('로그아웃')}</button>`,
  forbidden: () => `
    <h2>관리자 페이지는 열 수 없어요</h2>
    <p>기기 담당자와 총관리자만 볼 수 있어요.</p>
    <a class="btn" href="./">예약 화면으로</a>`,
};
const labOptions = () => `<option value="" disabled selected>${t('고르세요')}</option>
  ${S.labs.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}
  <option value="__other">${t('목록에 없어요 (직접 입력)')}</option>`;
// 언어 고르기 (사용자 화면만): 바꾸면 다시 불러옴
const langSeg = () => (PAGE === 'user'
  ? `<div class="seg lang-seg" data-lang-seg><button type="button" data-v="ko" class="${LANG === 'ko' ? 'on' : ''}">한국어</button><button type="button" data-v="en" class="${LANG === 'en' ? 'on' : ''}">English</button></div>`
  : '');
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lang-seg] button');
  if (!b || b.dataset.v === LANG) return;
  prefs.lang = b.dataset.v; savePrefs(); location.reload();
});
function gate(name) {
  $('app').hidden = true;
  $('gate').hidden = false;
  document.body.classList.remove('in-app');
  // 가입 폼을 쓰는 중에 연구실 목록이 바뀌면 고르는 칸만 새로 (적은 내용은 그대로)
  if (shown === name && name === 'signup') {
    const sel = $('signupForm').lab, v = sel.value;
    sel.innerHTML = labOptions();
    if ([...sel.options].some(o => o.value === v)) sel.value = v;
    return;
  }
  shown = name;
  $('gate').innerHTML = `<div class="panel gate-card">${GATES[name]()}</div>`;
  $('gateLogin')?.addEventListener('click', () => window.cloud?.login());
  $('gateLogout')?.addEventListener('click', () => window.cloud?.logout());
  const f = $('signupForm');
  if (f) {
    f.name.value = S.user?.displayName || '';
    f.lab.onchange = () => { $('labOtherRow').hidden = f.lab.value !== '__other'; f.labOther.required = f.lab.value === '__other'; };
    f.onsubmit = async ev => {
      ev.preventDefault();
      const other = f.lab.value === '__other';
      const labId = other ? null : f.lab.value;
      const lab = other ? f.labOther.value.trim() : labName(labId);
      try { await window.cloud.signup({ name: f.name.value.trim(), labId, labName: lab }); toast(t('가입 신청을 보냈어요')); }
      catch (e) { fail(t('신청하지 못했어요'), e); }
    };
  }
}

// ---------- 위 오른쪽 계정 버튼 + 설정 창 ----------
function showAccount() {
  const b = $('accountBtn');
  b.hidden = !S.user;
  if (!S.user) return;
  b.textContent = (S.me?.name || S.user.displayName || S.user.email || '?').slice(0, 1);
  b.title = `${S.user.email} · ${t('설정')}`;
  const link = $('adminLink');
  if (link) {
    link.hidden = !(shown === 'app' && canAdmin());
    const n = pendingBookings().length + pendingUsers().length; // 처리할 일 (알림 대신)
    $('adminBadge').hidden = !n;
    $('adminBadge').title = t('처리할 승인 대기');
    $('adminBadge').textContent = n;
  }
}
document.body.insertAdjacentHTML('beforeend', `
<dialog id="settingsDlg">
  <form method="dialog" class="form" id="settingsForm">
    <h2>${t('설정')}</h2>
    <fieldset id="meBox">
      <legend>${t('내 정보')}</legend>
      <label>${t('이름')}<span class="row"><input name="name" maxlength="40"><button type="button" class="btn" id="saveNameBtn">${t('저장')}</button></span></label>
      <p class="hint" id="meInfo"></p>
    </fieldset>
    <fieldset>
      <legend>${t('화면')}</legend>
      ${PAGE === 'user' ? `<div class="field">${t('언어')} ${langSeg()}</div>` : ''}
      <div class="field">${t('테마')} <div class="seg" id="themeSeg"><button type="button" data-v="auto">${t('자동')}</button><button type="button" data-v="light">${t('라이트')}</button><button type="button" data-v="dark">${t('다크')}</button></div></div>
      <div class="field">${t('글씨 크기')} <div class="seg" id="fsSeg"><button type="button" data-v="0.9">${t('작게')}</button><button type="button" data-v="1">${t('보통')}</button><button type="button" data-v="1.15">${t('크게')}</button><button type="button" data-v="1.3">${t('더 크게')}</button></div></div>
    </fieldset>
    <div class="actions"><button type="button" class="btn danger" id="logoutBtn">${t('로그아웃')}</button><button class="btn primary">${t('닫기')}</button></div>
  </form>
</dialog>
<div class="toast" id="toast" role="status" aria-live="polite" popover="manual"></div>`);

function openSettings() {
  const f = $('settingsForm');
  f.name.value = S.me?.name || '';
  $('meBox').hidden = !S.me;
  const role = S.me?.role === 'admin' ? t('총관리자') : S.me?.role === 'pending' ? t('가입 대기') : t('사용자');
  const managed = myEquip().map(e => e.name).join(', ');
  $('meInfo').textContent = `${S.user?.email || ''} · ${labName(S.me?.labId) || S.me?.labName || t('연구실 없음')} · ${role}${managed ? ` · ${t('담당: {list}', { list: managed })}` : ''}`;
  markSeg($('themeSeg'), prefs.theme);
  markSeg($('fsSeg'), String(prefs.fs));
  $('settingsDlg').showModal();
}
function markSeg(seg, v) { for (const b of seg.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === v); }
$('accountBtn').onclick = openSettings;
$('themeSeg').onclick = e => { const v = e.target.dataset?.v; if (!v) return; prefs.theme = v; savePrefs(); applyTheme(); markSeg($('themeSeg'), v); };
$('fsSeg').onclick = e => { const v = e.target.dataset?.v; if (!v) return; prefs.fs = Number(v); savePrefs(); applyTheme(); markSeg($('fsSeg'), v); };
$('logoutBtn').onclick = () => { $('settingsDlg').close(); window.cloud?.logout(); };
$('saveNameBtn').onclick = async () => {
  const name = $('settingsForm').name.value.trim();
  if (!name || name === S.me?.name) return;
  try { await window.cloud.updateMyName(name); toast(t('이름을 바꿨어요. 새 예약부터 이 이름으로 보여요')); }
  catch (e) { fail(t('이름을 바꾸지 못했어요'), e); }
};

// ---------- 탭(.seg) ----------
// 버튼 data-tab → 같은 id의 .tab 을 보이게. key: prefs에 기억할 이름
function bindTabs(seg, key, onChange) {
  const show = t => {
    for (const b of seg.querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === t);
    for (const el of document.querySelectorAll('.tab')) el.hidden = el.id !== `tab-${t}`;
    prefs[key] = t; savePrefs();
    onChange?.(t);
  };
  seg.addEventListener('click', e => { const t = e.target.closest('button')?.dataset.tab; if (t) show(t); });
  return show;
}

// ---------- 폰 뒤로 가기: 열린 창 닫기 → 첫 탭으로 → 한 번 더 누르면 종료 ----------
if (matchMedia('(pointer: coarse)').matches) {
  let lastBack = 0;
  history.pushState(null, '');
  addEventListener('popstate', () => {
    const open = document.querySelector('dialog[open]');
    if (open) open.close();
    else if (window.backToMain?.()) { /* 첫 탭으로 돌아감 */ }
    else if (Date.now() - lastBack < 2000) { history.back(); return; }
    else { lastBack = Date.now(); toast(t('한 번 더 누르면 종료돼요')); }
    history.pushState(null, '');
  });
}

// 사용자 화면(index.html)의 세 탭
if (PAGE === 'user') {
  const showTab = bindTabs($('tabSeg'), 'tab', render);
  window.goTab = showTab;
  window.appStart = () => showTab(['book', 'mine', 'equip'].includes(prefs.tab) ? prefs.tab : 'book');
  window.backToMain = () => { if (prefs.tab === 'book') return false; showTab('book'); return true; };
}

// HTML에 직접 쓴 글 (사용자 화면의 탭 이름 등): data-i18n은 글자만, data-i18n-html은 안쪽 HTML째로 바꿈
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.textContent.trim());
for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.innerHTML.trim());
if (PAGE === 'user') document.title = `${t('공동기기')}@KNUmed`;

applyTheme();
gate('loading');
