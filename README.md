# 공동기기@KNUmed (equip-hub)

여러 연구실이 같이 쓰는 공동기기를 예약하고 기기별 매뉴얼을 보는 웹앱(PWA)이에요. 구글 계정으로 로그인해 가입 신청을 하고, 총관리자가 승인하면 쓸 수 있어요. 설치 없이 브라우저에서 열고, 폰에서는 홈 화면에 추가해 앱처럼 써요.

**주소: https://kkonoo.github.io/equip-hub/** · 관리자 페이지: https://kkonoo.github.io/equip-hub/admin.html

## 사용자 화면

| 탭 | 하는 일 |
|---|---|
| 예약 | 기기를 고르면 주간 그리드(가로 요일, 세로 시간)가 나와요. 폰(900px 이하)에서는 하루 보기. 빈 칸을 누르면 예약 창이 열리고(시작·종료를 누른 칸으로 미리 채움, 밤샘은 종료 날짜를 바꿔서), 다른 사람 예약을 누르면 이름·연구실·시간이 보여요. 승인된 예약은 회색, 승인 대기는 점선, 내 예약은 크림슨, 점검·고장 기간은 빗금, 예약할 수 없는 시간은 옅은 회색이에요 |
| 내 예약 | 다가오는 예약과 지난 예약. 상태(승인 대기 · 승인 · 거절+사유 · 취소), 시작 전엔 취소, 끝난 예약엔 **사용일지 쓰기**(실제 시작·종료, 특이사항, 문제 있었음)와 미작성 표시 |
| 기기 | 기기 카드(이름, 위치, 상태, 담당자, 승인 필요 여부). 누르면 매뉴얼 본문, 링크(구글 드라이브의 PDF·사진), 예약 규칙이 나오고 바로 **예약하기**로 넘어가요 |

기기 담당자나 총관리자로 로그인하면 위에 **관리자 페이지** 링크가 보이고, 처리할 승인 대기 건수가 배지로 떠요. 오른쪽 위 동그라미(이름 첫 글자)를 누르면 이름 수정, 테마, 글씨 크기, 로그아웃이 있어요.

## 관리자 페이지 (admin.html)

담당자와 총관리자만 열 수 있어요. 담당자는 자기 담당 기기만 봐요.

| 탭 | 하는 일 | 보는 사람 |
|---|---|---|
| 예약 승인 | 승인 대기 목록, 승인 · 거절(사유), 같은 시간에 겹치는 신청 경고, 점검·고장 기간에 잡힌 예약 경고, 다가오는 예약을 사유를 적고 취소 | 담당자, 총관리자 |
| 가입 승인 | 가입 신청 승인(연구실 고르기 또는 직접 입력한 이름으로 새 연구실) · 거절, 사용자 목록에서 연구실 · 역할 · 사용 중(비활성화) 바꾸기 | 총관리자 |
| 기기 | 기기 추가 · 수정 · 삭제 · 순서, 담당자 지정, 승인 필요 여부, 예약 규칙, 상태(정상/점검/고장 + 사유 · 언제까지), 매뉴얼 · 링크 | 총관리자 전체, 담당자는 담당 기기(이름 · 위치 · 담당자 제외) |
| 사용일지 | 기기별 일지 목록('문제 있었음'은 위로), 사용일지가 없는 지난 예약 | 담당자, 총관리자 |
| 통계 | 월을 고르면 연구실 × 기기 사용 시간 표. 칸마다 합계와 '일지 · 예약'으로 나눠 보여 줘요 | 총관리자, 담당자는 담당 기기만 |
| 연구실 | 연구실 추가 · 이름 수정 · 순서, 가입 때 직접 입력된 연구실 정리 | 총관리자 |
| 데이터 | 전체 백업 파일 저장(JSON) | 총관리자 |

## 예약 규칙과 흐름

- 기기마다 **승인 필요**를 켜고 끌 수 있어요. 새 기기는 승인 필요가 기본값이에요. 승인 필요 기기는 '신청' → 담당자가 승인하면 확정, 아니면 '예약'하자마자 확정이에요.
- 승인 대기와 승인됨은 둘 다 그 시간을 차지하고, 거절되거나 취소되면 시간이 풀려요. 본인은 시작 전까지 취소할 수 있고, 담당자와 총관리자는 언제든 사유를 적고 취소할 수 있어요.
- 기기별 예약 규칙: **예약 단위**(기본 30분, 그리드 칸 크기), **1회 최대 시간**, **며칠 앞까지**(오늘부터 N일 뒤까지), **예약 가능 시간대**. 비워 두면 제한 없음이에요.
- **점검·고장**: 지금부터 '언제까지'까지 새 예약을 받지 않아요(그 뒤 날짜는 받아요). 끝을 비우면 정상으로 바꿀 때까지 막혀요. 이미 잡힌 예약은 자동으로 취소하지 않고 예약 승인 탭에 경고로 보여요.
- **겹침**: 저장하기 전에 같은 기기의 승인 대기 · 승인된 예약과 겹치는지 확인하고 막아요. 두 사람이 거의 동시에 같은 칸을 신청하면 둘 다 들어갈 수 있어요. 승인 필요 기기는 담당자 화면에 겹침 경고가 떠서 거기서 정리해요. 승인이 필요 없는 기기에서는 이 경우가 그대로 남아요(첫 버전의 알려진 한계).
- **사용 목적**은 본인 · 담당자 · 총관리자 화면에만 보여요. 다만 Firestore는 필드 단위로 숨길 수 없어서, 승인된 사용자라면 개발자 도구로 읽을 수는 있어요. 민감한 내용은 적지 않게 안내해 주세요.
- **통계**의 사용 시간은 사용일지가 있으면 실제 시간(일지), 없으면 승인된 예약 시간(예약)으로 세요. 끝난 예약만, 예약이 시작한 달 기준이에요.

## 처음 쓸 때

1. [Firebase 콘솔](https://console.firebase.google.com)에서 새 프로젝트를 만들어요.
2. **Authentication → 로그인 방법 → Google**을 켜고, **설정 → 승인된 도메인**에 `kkonoo.github.io`를 넣어요.
3. **Firestore Database**를 만들어요 (위치는 `asia-northeast3` 서울 추천).
4. **Firestore → 규칙**에 [`firestore.rules`](firestore.rules) 내용을 그대로 붙여 넣고 게시해요.
5. **Firestore → 색인 → 복합**에 아래 두 개를 만들어요 ([`firestore.indexes.json`](firestore.indexes.json)과 같아요). 안 만들면 그리드·통계가 안 열리고, 브라우저 콘솔 오류에 나오는 링크를 눌러도 만들 수 있어요.
   - 컬렉션 `bookings`: `equipId` 오름차순 + `end` 오름차순 (예약 그리드, 겹침 확인, 관리자 승인 목록)
   - 컬렉션 `bookings`: `equipId` 오름차순 + `start` 오름차순 (통계)
6. **프로젝트 설정 → 내 앱 → 웹 앱 추가**에서 나온 `firebaseConfig` 값을 [`js/firebase-config.js`](js/firebase-config.js)에 넣고 main에 올려요. 값이 `null`이면 '설정이 필요해요' 안내만 보여요. (이 값은 공개돼도 괜찮아요. 데이터 보호는 보안 규칙이 해요.)
7. 앱에서 구글로 로그인해 **가입 신청**을 해요. 그다음 Firebase 콘솔 **Firestore → 데이터 → `users` → 내 문서**에서 `role`을 `admin`으로 바꾸면 첫 총관리자가 돼요.
8. 관리자 페이지에서 **연구실**을 추가하고, **기기**를 추가해 담당자 · 예약 규칙 · 매뉴얼을 넣어요. 이후 가입 신청은 가입 승인 탭에서 처리해요.

## 데이터는 어디에

- 모든 데이터는 Firestore의 최상위 공유 컬렉션 다섯 개에 있어요. 여러 사람이 같은 데이터를 봐야 해서 `users/{uid}/…` 아래가 아니에요.

| 컬렉션 | 문서 하나 | 주요 필드 |
|---|---|---|
| `users/{uid}` | 사용자 | name, email, labId, labName, role(`pending` / `member` / `admin`), active, createdAt, approvedBy, approvedAt |
| `labs/{labId}` | 연구실 | name, order |
| `equipment/{equipId}` | 기기 | name, location, managers[uid], managerNames{uid: 이름}, requiresApproval, rules{slotMinutes, maxHours, maxDaysAhead, openFrom, openTo}, status(`ok` / `maintenance` / `broken`), statusNote, statusUntil, manual{body, links[{title, url}]}, order, updatedAt |
| `bookings/{bookingId}` | 예약 | equipId, uid, userName, labId, start, end, purpose, status(`pending` / `approved` / `rejected` / `cancelled`), decidedBy, decidedAt, reason, createdAt, updatedAt |
| `logs/{bookingId}` | 사용일지 (예약 하나에 하나) | equipId, uid, labId, actualStart, actualEnd, note, problem, createdAt, updatedAt |

- 시간은 Firestore Timestamp로 저장하고 화면은 서울 시간(Asia/Seoul)으로 보여 줘요.
- 예약에는 이름 · 연구실을, 기기에는 담당자 이름(managerNames)을 복사해 둬요. `users`는 본인과 총관리자만 읽을 수 있어서, 그리드와 기기 카드를 그릴 때 `users`를 읽지 않으려고요.
- 권한은 화면이 아니라 [`firestore.rules`](firestore.rules)에서 막아요. 로그인하지 않은 사람은 아무것도 못 읽고, 가입 대기 · 비활성 사용자는 연구실 목록과 자기 문서만 읽어요. 예약을 만들 때 규칙에서도 본인 · 이름 · 연구실, 승인 필요 여부에 맞는 상태, 점검 · 고장 기간, 1회 최대 시간, 며칠 앞까지를 확인해요. 예약끼리 겹치는지는 규칙으로 막을 수 없어요.
- 백업 파일(`equip-hub-backup-날짜.json`)에는 이름 · 이메일이 들어 있어요. 저장소에는 올리지 마세요 (`.gitignore`에 들어 있어요).
- 이 브라우저에는 테마 · 글씨 크기 · 마지막 탭 · 고른 기기만 `equip-hub-prefs`(localStorage)에 저장해요. Firestore 기기 캐시는 같은 주소의 다른 앱과 나눠 쓰는 여러 탭 방식으로 열어요.

## 첫 버전에서 뺀 것

- 이메일 · 푸시 알림 (Cloud Functions가 필요해서 결제 계정을 등록해야 해요). 지금은 앱 안 배지와 내 예약 상태로 대신해요.
- 파일 업로드 (매뉴얼의 PDF · 사진은 구글 드라이브 링크로).
- 사용료 정산, 통계 CSV 내보내기, 반복 예약, 구글 캘린더 연동.
- 동시 신청 완전 차단 (기기 · 날짜별 잠금 문서와 트랜잭션으로 나중에 더할 수 있어요).

## 개발

- 빌드 없는 HTML/CSS/JS예요. `js/sync.js`만 ES 모듈이고 Firebase SDK(12.19.0)는 gstatic에서 불러와요.
- 로컬 서버: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1` → http://localhost:8767/ (포트는 `PORT` 환경 변수로 바꿔요). Firebase 로그인을 로컬에서 쓰려면 승인된 도메인에 `localhost`도 넣어요.
- 아이콘: `tools/make-icons.ps1` (색은 HaLab 슬라이드 갤러리 크림슨 테마 단계).
- 새 js · css 파일을 만들면 `sw.js`의 `SHELL`에 꼭 더해요.
- 색: 공통 토큰은 kkonoo 앱들과 같고, accent는 HaLab 슬라이드 갤러리 크림슨 테마(주조색 `#B0283C`, 옅은 면 `#F7EAEC`, 강조색 `#2E9CCA`)예요.

| 파일 | 내용 |
|---|---|
| `index.html` | 사용자 화면 |
| `admin.html` | 관리자 페이지 |
| `css/style.css` | 토큰, 컴포넌트, 화면별 스타일 |
| `js/app.js` | 공통 상태, 로그인 상태에 따른 화면 전환, 서울 시간 도우미, toast, 테마, 설정 창 |
| `js/booking.js` | 예약 그리드, 예약 창 |
| `js/mine.js` | 내 예약, 사용일지 |
| `js/equipment.js` | 기기 목록, 매뉴얼 보기 |
| `js/admin.js` | 관리자 탭 |
| `js/stats.js` | 연구실 × 기기 사용 시간 계산 |
| `js/sync.js` | Google 로그인 + Firestore 읽기 · 쓰기 (module) |
| `js/firebase-config.js` | `firebaseConfig` (처음엔 `null`) |
| `firestore.rules` | 보안 규칙 |
| `firestore.indexes.json` | 복합 인덱스 (bookings: equipId + end, equipId + start) |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA |
| `tools/serve.ps1`, `tools/make-icons.ps1` | 로컬 서버, 아이콘 |
| `SPEC.md` | 첫 버전 스펙 |
