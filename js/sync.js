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
  // 받은 목록을 cb(목록)으로 넘기는 실시간 구독. 돌려준 함수를 부르면 끊김 (로그아웃하면 전부 끊김)
  const live = new Set();
  function watch(q, cb, what) {
    const off = F.onSnapshot(q, snap => cb(snap.docs.map(plain)), e => fail(`${what}을(를) 불러오지 못했어요`, e));
    live.add(off);
    return () => { live.delete(off); off(); };
  }

  // ---------- 로그인 ----------
  const login = () => A.signInWithPopup(auth, new A.GoogleAuthProvider()).catch(e => {
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') fail('로그인하지 못했어요', e);
  });
  const logout = () => A.signOut(auth);

  let unsubs = [], unsubEquip = null;
  const stop = () => {
    unsubs.forEach(f => f()); unsubs = []; unsubEquip?.(); unsubEquip = null;
    live.forEach(f => f()); live.clear();
    window.resetFeeds?.(); // 화면 쪽 구독 상태도 처음으로
  };

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
    watchMine: cb => watch(F.query(col('bookings'), F.where('uid', '==', S.user.uid)), cb, '내 예약'),

    // ---------- 사용일지: logs/{예약 id} (예약 하나에 하나) ----------
    watchMyLogs: cb => watch(F.query(col('logs'), F.where('uid', '==', S.user.uid)), cb, '사용일지'),
    saveLog: (b, { actualStart, actualEnd, note, problem }, isNew) => F.setDoc(ref('logs', b.id), {
      equipId: b.equipId, uid: S.user.uid, labId: b.labId || null,
      actualStart: ts(actualStart), actualEnd: ts(actualEnd), note, problem,
      updatedAt: now(), ...(isNew ? { createdAt: now() } : {}),
    }, { merge: true }),
    watchEquipLogs: (equipId, cb) => watch(F.query(col('logs'), F.where('equipId', '==', equipId)), cb, '사용일지'),
    watchEquipBookings: (equipId, cb) => watch(F.query(col('bookings'), F.where('equipId', '==', equipId)), cb, '예약'),

    // ---------- 통계·백업 ----------
    // 기기마다: 그 달에 시작한 예약(인덱스 bookings(equipId, start)) + 그 기기의 사용일지
    getUsage: async (equipIds, from, to) => {
      const res = await Promise.all(equipIds.map(id => Promise.all([
        F.getDocs(F.query(col('bookings'), F.where('equipId', '==', id), F.where('start', '>=', ts(from)), F.where('start', '<', ts(to)))),
        F.getDocs(F.query(col('logs'), F.where('equipId', '==', id))),
      ])));
      return { bookings: res.flatMap(([b]) => b.docs.map(plain)), logs: res.flatMap(([, l]) => l.docs.map(plain)) };
    },
    // 전체 백업: 다섯 컬렉션을 그대로 (시간은 ISO 문자열로)
    backup: async () => {
      const out = { app: 'equip-hub', exportedAt: new Date().toISOString() };
      for (const name of ['users', 'labs', 'equipment', 'bookings', 'logs']) {
        out[name] = (await F.getDocs(col(name))).docs.map(d => {
          const o = { id: d.id, ...d.data() };
          for (const k of Object.keys(o)) if (o[k] instanceof F.Timestamp) o[k] = o[k].toDate().toISOString();
          return o;
        });
      }
      return out;
    },

    // ---------- 관리자 페이지 ----------
    // 다가오는 예약 (승인 대기 목록·겹침 경고·점검 기간 경고). equipIds가 null이면 전체(총관리자)
    // 'in'은 30개까지 — 담당 기기가 그보다 많을 일은 없다고 봄
    watchUpcoming: (equipIds, after, cb) => watch(equipIds
      ? F.query(col('bookings'), F.where('equipId', 'in', equipIds.length ? equipIds : ['-']), F.where('end', '>', ts(after)))
      : F.query(col('bookings'), F.where('end', '>', ts(after))), cb, '예약'),
    // 담당자·총관리자: 승인·거절·취소 (사유와 처리한 사람 기록)
    decide: (id, status, reason = '') => F.updateDoc(ref('bookings', id), {
      status, reason, decidedBy: S.user.uid, decidedAt: now(), updatedAt: now(),
    }),
    watchUsers: cb => watch(col('users'), cb, '사용자 목록'),
    approveUser: (uid, labId) => F.updateDoc(ref('users', uid), { role: 'member', labId, active: true, approvedBy: S.user.uid, approvedAt: now() }),
    rejectUser: uid => F.deleteDoc(ref('users', uid)), // 신청이 지워져서 다시 신청할 수 있음
    updateUser: (uid, patch) => F.updateDoc(ref('users', uid), patch),
    addLab: async name => (await F.addDoc(col('labs'), { name, order: Math.max(0, ...S.labs.map(l => l.order ?? 0)) + 1 })).id,
    updateLab: (id, patch) => F.updateDoc(ref('labs', id), patch),
    saveEquipment: (id, data) => {
      const d = { ...data, updatedAt: now() };
      if ('statusUntil' in d) d.statusUntil = ts(d.statusUntil);
      return id ? F.updateDoc(ref('equipment', id), d) : F.addDoc(col('equipment'), d);
    },
    deleteEquipment: id => F.deleteDoc(ref('equipment', id)),
    reorder: (name, ids) => { // 목록 순서대로 order = 1, 2, 3…
      const b = F.writeBatch(fs);
      ids.forEach((id, i) => b.update(ref(name, id), { order: i + 1 }));
      return b.commit();
    },
  };
}
