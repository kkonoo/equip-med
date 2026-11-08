// 공동기기@KNUmed — 매뉴얼 파일 올리기 (Google Apps Script 웹 앱)
// 관리자 페이지 기기 수정 창에서 고른 파일(PDF·동영상 등)을 내 드라이브 '#공동기기' 폴더 안 '기기 이름' 폴더에 올리고
// 보기 링크를 돌려줘요. 설정 순서는 README의 '매뉴얼 파일 올리기 (Apps Script)'.
//   배포: 웹 앱 · 실행 사용자 '나' · 액세스 권한 '모든 사용자'
// 누가 올릴 수 있나: 앱의 총관리자, 그 기기 담당자. 앱 로그인 토큰(Firebase ID 토큰)으로 Firestore를 읽어 확인해요
//   (토큰이 가짜거나 만료됐으면 Firestore가 거절하고, firestore.rules가 본인 문서만 읽게 해서 남의 uid로 속일 수 없음).
// 큰 파일: 앱이 16MB씩 나눠 보내면 드라이브의 이어 올리기(resumable upload) 자리에 차례로 붙여요.
// 이 파일은 앱이 쓰지 않아요 (Apps Script 편집기에 붙여 넣는 원본).

var FOLDER_ID = '1Ioxj3epbd6YKuncnOK35EFSJWDfLAWq4'; // 드라이브 '#공동기기' 폴더 (주소의 folders/ 뒤)
var PROJECT_ID = 'equip-knumed';                     // Firebase 프로젝트
var CHUNK_MAX = 32 * 1024 * 1024;                     // 한 조각 상한 (앱은 16MB씩)

function doGet() { return json_({ ok: true, app: 'equip-med-upload' }); }

function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents);
    if (b.action === 'start') return json_(start_(b));
    if (b.action === 'chunk') return json_(chunk_(b));
    throw new Error('알 수 없는 요청이에요');
  } catch (err) {
    return json_({ ok: false, error: (err && err.message) || String(err) });
  }
}

// 1) 시작: 올리는 사람 확인 → 기기 폴더에 이어 올리기 자리를 만들고 번호(uploadId)를 돌려줌
function start_(b) {
  var who = checkUser_(b.idToken, b.equipId);
  var size = Number(b.size);
  if (!(size > 0)) throw new Error('빈 파일이에요');
  var name = String(b.name || '파일').slice(0, 200);
  var mimeType = String(b.mimeType || 'application/octet-stream');
  var folder = equipFolder_(who.equipName);
  var r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType', {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(size) },
    payload: JSON.stringify({ name: name, parents: [folder.getId()], description: '공동기기@KNUmed 매뉴얼 · ' + who.equipName }),
    muteHttpExceptions: true,
    followRedirects: false,
  });
  var session = header_(r, 'location');
  if (r.getResponseCode() !== 200 || !session) throw new Error('드라이브에 올릴 자리를 만들지 못했어요 (' + r.getResponseCode() + ')');
  var uploadId = Utilities.getUuid();
  CacheService.getScriptCache().put('up:' + uploadId, JSON.stringify({ session: session, size: size, mimeType: mimeType }), 21600); // 6시간
  return { ok: true, uploadId: uploadId };
}

// 2) 조각: base64 조각을 이어 붙임. 마지막 조각이면 '링크가 있는 모든 사용자 보기'로 두고 파일 정보를 돌려줌
function chunk_(b) {
  var cache = CacheService.getScriptCache();
  var saved = cache.get('up:' + b.uploadId);
  if (!saved) throw new Error('올리기 시간이 지났어요. 다시 올려 주세요');
  var up = JSON.parse(saved);
  var bytes = Utilities.base64Decode(String(b.data || ''));
  var from = Number(b.offset), to = from + bytes.length - 1;
  if (!bytes.length || bytes.length > CHUNK_MAX || !(from >= 0) || to >= up.size) throw new Error('조각이 맞지 않아요. 다시 올려 주세요');
  var r = UrlFetchApp.fetch(up.session, {
    method: 'put',
    contentType: up.mimeType,
    payload: bytes,
    headers: { 'Content-Range': 'bytes ' + from + '-' + to + '/' + up.size },
    muteHttpExceptions: true,
    followRedirects: false, // 308 = 다음 조각을 기다림 (따라가면 안 됨)
  });
  var code = r.getResponseCode();
  if (code === 308) return { ok: true, done: false };
  if (code !== 200 && code !== 201) throw new Error('드라이브에 올리지 못했어요 (' + code + ')');
  var f = JSON.parse(r.getContentText());
  try { DriveApp.getFileById(f.id).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) { /* 폴더 공유를 따름 */ }
  cache.remove('up:' + b.uploadId);
  return { ok: true, done: true, file: { id: f.id, name: f.name, mimeType: f.mimeType, url: 'https://drive.google.com/file/d/' + f.id + '/view' } };
}

// 앱 로그인 토큰으로 Firestore의 내 사용자 문서와 기기 문서를 읽어 권한 확인
function checkUser_(idToken, equipId) {
  if (!idToken || !equipId) throw new Error('로그인 정보가 없어요. 다시 로그인해 주세요');
  var part = String(idToken).split('.')[1] || '';
  part += '==='.slice((part.length + 3) % 4);
  var uid = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(part)).getDataAsString()).sub;
  var me = fsGet_('users/' + encodeURIComponent(uid), idToken);
  if (!me) throw new Error('앱 사용자 정보를 읽지 못했어요. 다시 로그인해 주세요');
  var eq = fsGet_('equipment/' + encodeURIComponent(equipId), idToken);
  if (!eq) throw new Error('기기를 찾지 못했어요');
  var role = field_(me, 'role'), active = field_(me, 'active') !== false;
  var mf = (eq.fields || {}).managers, managers = (mf && mf.arrayValue && mf.arrayValue.values) || [];
  var isManager = managers.some(function (v) { return v.stringValue === uid; });
  if (!active || !(role === 'admin' || (role === 'member' && isManager))) throw new Error('총관리자나 이 기기 담당자만 올릴 수 있어요');
  return { uid: uid, equipName: field_(eq, 'name') || equipId };
}
function fsGet_(path, idToken) {
  var r = UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/' + path, {
    headers: { Authorization: 'Bearer ' + idToken }, muteHttpExceptions: true,
  });
  return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()) : null;
}
function field_(doc, k) {
  var v = (doc.fields || {})[k];
  if (!v) return null;
  return 'stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue : null;
}

// '#공동기기' 안의 기기 이름 폴더 (없으면 만듦, 동시에 두 개 생기지 않게 잠금)
function equipFolder_(equipName) {
  var name = String(equipName).replace(/[\\/]/g, ' ').slice(0, 100);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var root = DriveApp.getFolderById(FOLDER_ID), it = root.getFoldersByName(name);
    return it.hasNext() ? it.next() : root.createFolder(name);
  } finally { lock.releaseLock(); }
}

function header_(res, key) {
  var h = res.getAllHeaders();
  for (var k in h) if (k.toLowerCase() === key) return Array.isArray(h[k]) ? h[k][0] : h[k];
  return null;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
