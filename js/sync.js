// Google 로그인 + Firestore 읽기·쓰기 (Firebase Auth + Firestore). 모든 데이터는 여기서만 오가요.
// firebase-config.js 가 null 이면 '설정이 필요해요' 화면만 보여 줘요.
// 컬렉션 (최상위, 여러 사람이 같이 봄 — 권한은 firestore.rules)
//   users/{uid}            사용자 (가입 신청 = role 'pending')
//   labs/{labId}           연구실
//   equipment/{equipId}    기기 (담당자, 예약 규칙, 상태, 매뉴얼, 교육 기록)
//   photos/{equipId}       기기 사진 { src } — 기기 목록과 따로 받아서 기기를 고쳐도 사진을 다시 받지 않음
//   bookings/{bookingId}   예약
//   logs/{bookingId}       사용일지 (예약 하나에 하나)
// 다른 파일은 window.cloud 의 함수만 써요. 시간은 주고받을 때 ms 숫자 ↔ Timestamp 로 바꿈.
import * as CFG from './firebase-config.js'; // firebaseConfig, manualUploadUrl
const { firebaseConfig } = CFG;

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
    const off = F.onSnapshot(q, snap => cb(snap.docs.map(plain)), e => fail(t('{what}을(를) 불러오지 못했어요', { what: t(what) }), e));
    live.add(off);
    return () => { live.delete(off); off(); };
  }

  // ---------- 로그인 ----------
  const login = () => A.signInWithPopup(auth, new A.GoogleAuthProvider()).catch(e => {
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') fail(t('로그인하지 못했어요'), e);
  });
  const logout = () => A.signOut(auth);

  let unsubs = [], unsubEquip = null, unsubPhotos = null;
  const stop = () => {
    unsubs.forEach(f => f()); unsubs = []; unsubEquip?.(); unsubEquip = null; unsubPhotos?.(); unsubPhotos = null;
    live.forEach(f => f()); live.clear();
    window.resetFeeds?.(); // 화면 쪽 구독 상태도 처음으로
  };

  A.onAuthStateChanged(auth, u => {
    stop();
    Object.assign(S, { user: u, me: null, meLoaded: false, labs: [], equipment: [], equipLoaded: false, photos: new Map(), photosLoaded: false });
    if (!u) return onAuth();
    onAuth();
    // 내 사용자 문서: 가입 신청·승인·비활성화가 바로 화면에 반영됨
    unsubs.push(F.onSnapshot(ref('users', u.uid), snap => {
      S.me = snap.exists() ? plain(snap) : null;
      S.meLoaded = true;
      const ok = S.me && S.me.active !== false && (S.me.role === 'member' || S.me.role === 'admin');
      if (ok && !unsubEquip) {
        unsubEquip = watch(col('equipment'), list => { S.equipment = list.sort(byOrder); S.equipLoaded = true; onData(); }, '기기 목록');
        unsubPhotos = watch(col('photos'), list => { S.photos = new Map(list.map(p => [p.id, p.src])); S.photosLoaded = true; onData(); }, '기기 사진');
      } else if (!ok && unsubEquip) {
        unsubEquip(); unsubEquip = null; S.equipment = []; S.equipLoaded = false;
        unsubPhotos?.(); unsubPhotos = null; S.photos = new Map(); S.photosLoaded = false;
      }
      onAuth();
    }, e => fail(t('계정 정보를 불러오지 못했어요'), e)));
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
    watchBookings: (equipId, after, cb) => watch(F.query(col('bookings'), F.where('equipId', '==', equipId), F.where('end', '>', ts(after))), cb, '예약 목록'),
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
    watchMine: cb => watch(F.query(col('bookings'), F.where('uid', '==', S.user.uid)), cb, '내 예약 목록'),

    // ---------- 사용일지: logs/{예약 id} (예약 하나에 하나) ----------
    watchMyLogs: cb => watch(F.query(col('logs'), F.where('uid', '==', S.user.uid)), cb, '사용일지 목록'),
    saveLog: (b, { actualStart, actualEnd, note, problem }, isNew) => F.setDoc(ref('logs', b.id), {
      equipId: b.equipId, uid: S.user.uid, labId: b.labId || null,
      actualStart: ts(actualStart), actualEnd: ts(actualEnd), note, problem,
      updatedAt: now(), ...(isNew ? { createdAt: now() } : {}),
    }, { merge: true }),
    watchEquipLogs: (equipId, cb) => watch(F.query(col('logs'), F.where('equipId', '==', equipId)), cb, '사용일지 목록'),
    watchEquipBookings: (equipId, cb) => watch(F.query(col('bookings'), F.where('equipId', '==', equipId)), cb, '예약 목록'),

    // ---------- 통계·백업 ----------
    // 기기마다: 그 달에 시작한 예약(인덱스 bookings(equipId, start)) + 그 기기의 사용일지
    getUsage: async (equipIds, from, to) => {
      const res = await Promise.all(equipIds.map(id => Promise.all([
        F.getDocs(F.query(col('bookings'), F.where('equipId', '==', id), F.where('start', '>=', ts(from)), F.where('start', '<', ts(to)))),
        F.getDocs(F.query(col('logs'), F.where('equipId', '==', id))),
      ])));
      return { bookings: res.flatMap(([b]) => b.docs.map(plain)), logs: res.flatMap(([, l]) => l.docs.map(plain)) };
    },
    // 전체 백업: 여섯 컬렉션을 그대로 (시간은 ISO 문자열로, 올린 사진도 data URL 그대로)
    backup: async () => {
      const out = { app: 'equip-med', exportedAt: new Date().toISOString() };
      for (const name of ['users', 'labs', 'equipment', 'photos', 'bookings', 'logs']) {
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
      : F.query(col('bookings'), F.where('end', '>', ts(after))), cb, '예약 목록'),
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
    deleteEquipment: id => { // 사진도 같이 지움
      const b = F.writeBatch(fs);
      b.delete(ref('equipment', id)); b.delete(ref('photos', id));
      return b.commit();
    },
    // 매뉴얼 파일 올리기: Apps Script 웹 앱(tools/drive-upload.gs)을 거쳐 내 드라이브 '#공동기기' 폴더로.
    // 16MB씩 나눠 보냄 (웹 앱이 한 번에 받는 크기 제한 안). 돌려주는 것: { id, name, mimeType, url }
    canUpload: !!CFG.manualUploadUrl,
    uploadManual: async (equipId, file, onProgress) => {
      const post = async body => {
        let res;
        try { res = await fetch(CFG.manualUploadUrl, { method: 'POST', body: JSON.stringify(body) }); } // text/plain이라 CORS 사전 요청 없음
        catch (e) { throw Object.assign(e, { userMsg: '올리기 서버에 연결하지 못했어요. 인터넷을 확인하고 다시 올려 주세요' }); }
        const j = await res.json().catch(() => null);
        if (!j?.ok) throw Object.assign(new Error(j?.error || `HTTP ${res.status}`), { userMsg: j?.error || '올리지 못했어요' });
        return j;
      };
      const b64 = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => no(r.error); r.readAsDataURL(blob); });
      const { uploadId } = await post({ action: 'start', idToken: await auth.currentUser.getIdToken(), equipId, name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size });
      const CHUNK = 16 * 1024 * 1024; // 256KB의 배수여야 함 (드라이브 이어 올리기 규칙)
      let last = null;
      for (let off = 0; off < file.size; off += CHUNK) {
        last = await post({ action: 'chunk', uploadId, offset: off, data: await b64(file.slice(off, off + CHUNK)) });
        onProgress?.(Math.min(1, (off + CHUNK) / file.size));
      }
      if (!last?.done) throw Object.assign(new Error('not finished'), { userMsg: '끝까지 올리지 못했어요. 다시 올려 주세요' });
      return last.file;
    },

    // 기기 사진 (담당자·총관리자): src = 앱에 들어 있는 사진 경로(img/equip/…) 또는 줄인 사진의 data URL
    savePhoto: (equipId, src) => F.setDoc(ref('photos', equipId), { src, by: S.user.uid, updatedAt: now() }),
    deletePhoto: equipId => F.deleteDoc(ref('photos', equipId)),
    // 교육 기록: equipment.trained.{uid} (담당자·총관리자). 날짜는 서울 기준 그날
    markTrained: (equipId, { uid, name, labId }) => F.updateDoc(ref('equipment', equipId),
      new F.FieldPath('trained', uid), { name, labId: labId || null, date: ymd(Date.now()), by: S.user.uid, byName: S.me.name },
      'updatedAt', now()),
    unmarkTrained: (equipId, uid) => F.updateDoc(ref('equipment', equipId), new F.FieldPath('trained', uid), F.deleteField(), 'updatedAt', now()),
    reorder: (name, ids) => { // 목록 순서대로 order = 1, 2, 3…
      const b = F.writeBatch(fs);
      ids.forEach((id, i) => b.update(ref(name, id), { order: i + 1 }));
      return b.commit();
    },
  };
}
