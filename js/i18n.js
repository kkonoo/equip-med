// 사용자 화면 영어 (외국인 대학원생용). 한국어 문장을 그대로 키로 써요: t('예약했어요') → 'Booked'
// {n} 같은 칸은 t('…{n}…', { n }) 로 채움. 사전에 없으면 한국어 그대로 보여요.
// 한국어는 같은데 영어가 다를 때는 '취소|버튼'처럼 | 뒤에 쓰임새를 붙임 (한국어 화면엔 | 앞만 보임)
// 관리자 페이지(admin.html)는 한국어로 고정. 언어는 처음엔 브라우저 언어를 따르고, 로그인 화면·설정에서 바꿔요.
const LANG = (() => {
  if (document.body.dataset.page === 'admin') return 'ko';
  try { const p = JSON.parse(localStorage.getItem('equip-med-prefs')); if (p?.lang === 'ko' || p?.lang === 'en') return p.lang; } catch { /* 없음 */ }
  return /^ko\b/i.test(navigator.language || '') ? 'ko' : 'en';
})();
document.documentElement.lang = LANG;

function t(s, v) {
  let out = LANG === 'en' ? (EN[s] ?? s.split('|')[0]) : s.split('|')[0];
  if (v) out = out.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
  return out;
}

const EN = {
  // 이름·상태
  '공동기기': 'Shared Equipment',
  '정상': 'OK', '점검': 'Maintenance', '고장': 'Out of order',
  '승인 대기': 'Pending', '승인': 'Approved', '거절': 'Rejected', '취소': 'Cancelled',
  '이름 없음': 'No name', '담당자 없음': 'No manager', '삭제된 기기': 'Deleted equipment',
  '바로 확정': 'Instant booking', '승인 필요': 'Approval needed',
  // 예약 규칙
  '예약 단위 {n}분': '{n}-min slots',
  '1회 최대 {n}시간': 'Up to {n} h per booking',
  '1회 시간 제한 없음': 'No time limit per booking',
  '오늘부터 {n}일 뒤까지 예약': 'Book up to {n} days ahead',
  '며칠 앞이든 예약': 'Book any day ahead',
  '예약 가능 {from}–{to}': 'Bookable {from}–{to}',
  '하루 종일 예약 가능': 'Bookable all day',
  '예약하면 바로 확정': 'Confirmed right away',
  '담당자 승인 뒤 확정': 'Confirmed after the manager approves',
  '{when}까지': 'until {when}',
  // 공통 메시지
  '{what}: 권한이 없어요': '{what}: permission denied',
  '{what}을(를) 불러오지 못했어요': "Couldn't load {what}",
  '기기 목록': 'the equipment list', '연구실 목록': 'the lab list', '예약 목록': 'bookings', '내 예약 목록': 'your bookings', '사용일지 목록': 'usage logs',
  '예약': 'Book', '내 예약': 'My bookings', '사용일지': 'Usage log',
  '내 예약|칸': 'Mine', '내 예약|창': 'My booking', '예약|창': 'Booking', '취소|버튼': 'Cancel',
  '{name} 예약': 'Book {name}', '{name} 예약 신청': 'Request {name}',
  '사용자 목록': 'the user list', '계정 정보를 불러오지 못했어요': "Couldn't load your account", '로그인하지 못했어요': "Couldn't sign in",
  '한 번 더 누르면 종료돼요': 'Press back again to exit',
  // 로그인 전·가입
  '불러오는 중이에요…': 'Loading…',
  '설정이 필요해요': 'Setup needed',
  '아직 Firebase 프로젝트가 연결되지 않았어요.': 'No Firebase project is connected yet.',
  'Firebase 콘솔에서 프로젝트를 만들고 Authentication(Google)과 Firestore를 켜요.': 'Create a project in the Firebase console and turn on Authentication (Google) and Firestore.',
  '프로젝트 설정 > 내 앱(웹)의 firebaseConfig 값을 js/firebase-config.js에 넣어요.': 'Copy firebaseConfig from Project settings > Your apps (web) into js/firebase-config.js.',
  'firestore.rules를 Firestore 규칙에 붙여 넣어요.': 'Paste firestore.rules into the Firestore rules.',
  "자세한 순서는 README의 '처음 쓸 때'에 있어요.": "See '처음 쓸 때' (getting started) in the README.",
  '연결하지 못했어요': "Couldn't connect",
  'Firebase를 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고침해 주세요.': "Couldn't load Firebase. Check your internet connection and reload.",
  '새로 고침': 'Reload',
  '연구실이 같이 쓰는 기기를 예약하고 매뉴얼을 볼 수 있어요.': 'Book the equipment shared by our labs and read its manuals.',
  'Google 계정으로 로그인해 주세요.': 'Please sign in with your Google account.',
  'Google로 로그인': 'Sign in with Google',
  '가입 신청': 'Sign up',
  '처음 오셨네요. 이름과 소속 연구실을 적어 주세요. 총관리자가 승인하면 쓸 수 있어요.': 'Welcome! Enter your name and lab. You can start once the administrator approves you.',
  '이름': 'Name', '연구실': 'Lab', '계정': 'Account',
  '고르세요': 'Choose', '목록에 없어요 (직접 입력)': 'Not listed (type it in)',
  '연구실 이름': 'Lab name', '예: 분자생물학 연구실': 'e.g. Molecular Biology Lab',
  '{email} 계정으로 신청해요.': 'You are signing up as {email}.',
  '로그아웃': 'Sign out', '신청': 'Request',
  '가입 신청을 보냈어요': 'Sign-up request sent', '신청하지 못했어요': "Couldn't send the request",
  '승인 대기 중이에요': 'Waiting for approval',
  '가입 신청을 보냈어요. 총관리자가 승인하면 바로 쓸 수 있어요.': 'Your sign-up request was sent. You can start as soon as the administrator approves it.',
  '이용이 중지된 계정이에요': 'This account is deactivated',
  '총관리자에게 문의해 주세요.': 'Please contact the administrator.',
  // 위 막대·설정
  '관리<span class="wide-only">자 페이지</span>': 'Admin<span class="wide-only"> page</span>',
  '기기': 'Equipment', '설정': 'Settings', '내 정보': 'My info', '저장': 'Save', '화면': 'Display',
  '테마': 'Theme', '자동': 'Auto', '라이트': 'Light', '다크': 'Dark',
  '글씨 크기': 'Text size', '작게': 'Small', '보통': 'Normal', '크게': 'Large', '더 크게': 'Larger',
  '닫기': 'Close', '언어': 'Language', '처리할 승인 대기': 'Pending approvals to handle',
  '총관리자': 'Administrator', '가입 대기': 'Pending sign-up', '사용자': 'User', '연구실 없음': 'No lab', '담당: {list}': 'Manager of: {list}',
  '이름을 바꿨어요. 새 예약부터 이 이름으로 보여요': 'Name changed. New bookings will show this name',
  '이름을 바꾸지 못했어요': "Couldn't change your name",
  // 기기 탭
  '아직 등록된 기기가 없어요. 관리자 페이지 > 기기에서 추가할 수 있어요.': 'No equipment yet. You can add some in Admin page > 기기.',
  '아직 등록된 기기가 없어요. 총관리자가 추가하면 여기에 보여요.': 'No equipment yet. It will show up here once the administrator adds it.',
  '아직 등록된 기기가 없어요.': 'No equipment yet.',
  '위치 없음': 'No location',
  '매뉴얼': 'Manual', '아직 매뉴얼이 없어요.': 'No manual yet.', '링크': 'Links', '예약 규칙': 'Booking rules', '예약하기': 'Book this',
  // 예약 탭
  '이전': 'Previous', '오늘': 'Today', '다음': 'Next', '점검·고장': 'Maintenance', '예약 불가': 'Not bookable',
  '종료가 시작보다 뒤여야 해요.': 'The end must be after the start.',
  '이미 지난 시간이에요.': 'That time has already passed.',
  '{status} 중이라 예약할 수 없어요.': "Can't book: {status}.",
  '{status} 중이라 {when}까지는 예약할 수 없어요.': "Can't book until {when} ({status}).",
  '예약 단위({n}분)에 맞춰 주세요.': 'Please use {n}-minute slots.',
  '오늘부터 {n}일 뒤까지만 예약할 수 있어요.': 'You can only book up to {n} days ahead.',
  '한 번에 {n}시간까지 예약할 수 있어요.': 'You can book up to {n} hours at a time.',
  '예약 가능 시간({from}–{to}) 안에서만 예약할 수 있어요.': 'You can only book within {from}–{to}.',
  '시작 날짜': 'Start date', '시작 시각': 'Start time', '종료 날짜': 'End date', '종료 시각': 'End time',
  '사용 목적': 'Purpose', '예: 세포 이미징 (형광 3채널)': 'e.g. cell imaging (3 fluorescence channels)',
  '사용 목적은 본인과 담당자·총관리자 화면에만 보여요.': 'Only you, the equipment manager and the administrator see the purpose.',
  '그 시간에 다른 예약이 있어요: {list}': 'Another booking is at that time: {list}',
  '예약했어요': 'Booked', '신청했어요. 담당자가 승인하면 확정돼요': 'Requested. It is confirmed once the manager approves',
  '예약하지 못했어요': "Couldn't book",
  '시간': 'Time', '예약 취소': 'Cancel booking', '관리자 페이지에서 처리': 'Handle in the admin page',
  '이 예약을 취소할까요?': 'Cancel this booking?', '예약을 취소했어요': 'Booking cancelled', '취소하지 못했어요': "Couldn't cancel",
  // 내 예약 탭
  '사유: {r}': 'Reason: {r}', '다가오는 예약': 'Upcoming', '{n}건': '{n}', '지난 예약': 'Past',
  '다가오는 예약이 없어요. 예약 탭에서 빈 칸을 눌러 예약해요.': 'No upcoming bookings. Tap an empty slot in the Book tab to book.',
  '사용일지를 안 쓴 예약 {n}건': '{n} without a usage log', '사용일지를 다 썼어요': 'All usage logs written',
  '✎ 사용일지': '✎ Usage log', '사용일지 쓰기': 'Write usage log', '문제 있었음': 'Had a problem', '일지 씀': 'Logged', '미작성': 'No log',
  '지난 예약이 없어요.': 'No past bookings.',
  '{name} {when} 예약을 취소할까요?': 'Cancel the booking for {name}, {when}?',
  '예약 {when}': 'Booked {when}', '실제 시작': 'Actual start', '실제 종료': 'Actual end', '특이사항': 'Notes',
  '예: 488 레이저 출력이 평소보다 낮았어요': 'e.g. the 488 laser power was lower than usual',
  '문제 있었음 (담당자 화면에 위로 보여요)': 'Had a problem (shown at the top for the manager)',
  '실제 종료가 시작보다 뒤여야 해요.': 'The actual end must be after the start.',
  '사용일지를 저장했어요': 'Usage log saved', '저장하지 못했어요': "Couldn't save",
};
