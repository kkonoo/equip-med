// Google 로그인 + Firestore 읽기·쓰기 (Firebase Auth + Firestore). 모든 데이터는 여기서만 오가요.
// firebase-config.js 가 null 이면 '설정이 필요해요' 화면만 보여 줘요.
// 컬렉션 (최상위, 여러 사람이 같이 봄 — 권한은 firestore.rules)
//   users/{uid}            사용자 (가입 신청 = role 'pending')
//   labs/{labId}           연구실
//   equipment/{equipId}    기기 (담당자, 예약 규칙, 상태, 매뉴얼)
//   bookings/{bookingId}   예약
//   logs/{bookingId}       사용일지 (예약 하나에 하나)
// 다른 파일은 window.cloud 의 함수만 써요. 시간은 주고받을 때 ms 숫자 ↔ Timestamp 로 바꿈.
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';

if (!firebaseConfig) gate('setup');
else start().catch(e => { console.error('Firebase 시작 실패', e); gate('error'); });

async function start() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  // 같은 주소(kkonoo.github.io)의 다른 앱과 기기 캐시를 같이 쓰므로 여러 탭 방식
  const fs = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });

  const col = name => F.collection(fs, name);
  const ref = (name, id) => F.doc(fs, name, id);
  const ts = ms => (ms == null ? null : F.Timestamp.fromMillis(ms));
  const now = F.serverTimestamp;
  // 문서 → { id, ...필드 } (Timestamp는 ms 숫자로)
  function plain(snap) {
    const o = { id: snap.id, ...snap.data() };
    for (const k of Object.keys(o)) if (o[k] instanceof F.Timestamp) o[k] = o[k].toMillis();
    return o;
  }
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name), 'ko');
  // 받은 목록을 cb(목록)으로 넘기는 실시간 구독. 돌려준 함수를 부르면 끊김
  function watch(q, cb, what) {
    return F.onSnapshot(q, snap => cb(snap.docs.map(plain)), e => fail(`${what}을(를) 불러오지 못했어요`, e));
  }

  // ---------- 로그인 ----------
  const login = () => A.signInWithPopup(auth, new A.GoogleAuthProvider()).catch(e => {
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') fail('로그인하지 못했어요', e);
  });
  const logout = () => A.signOut(auth);

  let unsubs = [], unsubEquip = null;
  const stop = () => { unsubs.forEach(f => f()); unsubs = []; unsubEquip?.(); unsubEquip = null; };

  A.onAuthStateChanged(auth, u => {
    stop();
    Object.assign(S, { user: u, me: null, meLoaded: false, labs: [], equipment: [], equipLoaded: false });
    if (!u) return onAuth();
    onAuth();
    // 내 사용자 문서: 가입 신청·승인·비활성화가 바로 화면에 반영됨
    unsubs.push(F.onSnapshot(ref('users', u.uid), snap => {
      S.me = snap.exists() ? plain(snap) : null;
      S.meLoaded = true;
      const ok = S.me && S.me.active !== false && (S.me.role === 'member' || S.me.role === 'admin');
      if (ok && !unsubEquip) {
        unsubEquip = watch(col('equipment'), list => { S.equipment = list.sort(byOrder); S.equipLoaded = true; onData(); }, '기기 목록');
      } else if (!ok && unsubEquip) {
        unsubEquip(); unsubEquip = null; S.equipment = []; S.equipLoaded = false;
      }
      onAuth();
    }, e => fail('계정 정보를 불러오지 못했어요', e)));
    // 연구실 목록: 가입 폼에도 필요해서 로그인만 하면 받음
    unsubs.push(watch(col('labs'), list => { S.labs = list.sort(byOrder); onData(); }, '연구실 목록'));
  });

  window.cloud = {
    login, logout,

    // ---------- 사용자 ----------
    signup: ({ name, labId, labName }) => F.setDoc(ref('users', S.user.uid), {
      name, email: S.user.email, labId: labId || null, labName: labName || '', role: 'pending', active: true, createdAt: now(),
    }),
    updateMyName: name => F.updateDoc(ref('users', S.user.uid), { name }),

    // ---------- 예약 ----------
    // 한 기기의 예약 중 after 이후에 끝나는 것 (그리드·겹침 확인) — 인덱스 bookings(equipId, end)
    watchBookings: (equipId, after, cb) => watch(F.query(col('bookings'), F.where('equipId', '==', equipId), F.where('end', '>', ts(after))), cb, '예약'),
    findOverlaps: async (equipId, start, end) => {
      const snap = await F.getDocs(F.query(col('bookings'), F.where('equipId', '==', equipId), F.where('end', '>', ts(start))));
      return snap.docs.map(plain).filter(b => b.start < end);
    },
    // 예약에 이름·연구실을 복사해 둠 (그리드를 그릴 때 users를 다시 읽지 않게)
    createBooking: ({ equipId, start, end, purpose, status }) => F.addDoc(col('bookings'), {
      equipId, uid: S.user.uid, userName: S.me.name, labId: S.me.labId || null,
      start: ts(start), end: ts(end), purpose, status, createdAt: now(), updatedAt: now(),
    }),
    cancelMine: id => F.updateDoc(ref('bookings', id), { status: 'cancelled', updatedAt: now() }),
  };
}
