// 관리자 페이지 (admin.html): 담당자와 총관리자만. 담당자는 자기 담당 기기만 봐요.
// 탭: 예약 승인 · 가입 승인 · 기기 · 사용일지 · 통계 · 연구실 · 데이터 (총관리자만 보는 탭은 who: 'admin')
const ADMIN_TABS = [
  { id: 'bookings', label: '예약 승인', who: 'manager', render: renderApprovals, badge: () => pendingBookings().length },
  { id: 'users', label: '가입 승인', who: 'admin', render: renderUsers, badge: () => pendingUsers().length },
  { id: 'equip', label: '기기', who: 'manager', render: renderEquipAdmin },
  { id: 'logs', label: '사용일지', who: 'manager', render: renderLogs },
  { id: 'stats', label: '통계', who: 'manager', render: renderStats },
  { id: 'labs', label: '연구실', who: 'admin', render: renderLabs },
  { id: 'data', label: '데이터', who: 'admin', render: renderData },
];
const adminTabs = () => ADMIN_TABS.filter(t => t.who === 'manager' || isAdmin());
// 연구실 이름으로 id 찾기 — 같은 이름(대소문자·앞뒤 공백 무시)이 이미 있으면 그걸 쓰고, 없으면 새로 추가
async function labIdFor(name) {
  const key = name.trim().toLowerCase();
  return S.labs.find(l => l.name.trim().toLowerCase() === key)?.id || window.cloud.addLab(name.trim());
}
const scopeEquip = () => (isAdmin() ? S.equipment : myEquip()); // 볼 수 있는 기기
let adminShow = null, deferred = false;

window.appStart = () => {
  const tabs = adminTabs();
  $('adminTabs').innerHTML = ADMIN_TABS.map(t => `<div class="tab" id="tab-${t.id}" hidden></div>`).join('');
  adminShow = bindTabs($('adminSeg'), 'adminTab', render);
  window.backToMain = () => { if (prefs.adminTab === tabs[0].id) return false; adminShow(tabs[0].id); return true; };
  adminShow(tabs.some(t => t.id === prefs.adminTab) ? prefs.adminTab : tabs[0].id);
};

function renderAdmin() {
  // 입력 칸을 쓰는 중이면 다시 그리지 않고, 칸을 벗어날 때 그림 (쓰던 글이 지워지지 않게)
  const ae = document.activeElement;
  if (ae && $('adminTabs').contains(ae) && ae.matches('input, textarea, select')) { deferred = true; return; }
  const tabs = adminTabs();
  if (!tabs.some(t => t.id === prefs.adminTab)) return adminShow(tabs[0].id);
  $('adminSeg').innerHTML = tabs.map(t => {
    const n = t.badge?.() || 0;
    return `<button type="button" data-tab="${t.id}" class="${t.id === prefs.adminTab ? 'on' : ''}">${t.label}${n ? ` <span class="badge">${n}</span>` : ''}</button>`;
  }).join('');
  ADMIN_TABS.find(t => t.id === prefs.adminTab).render($(`tab-${prefs.adminTab}`));
}
$('adminTabs').addEventListener('focusout', () => {
  if (deferred) { deferred = false; setTimeout(() => { if (shown === 'app') renderAdmin(); }); }
});

// ---------- 공통: 사유 묻기 ----------
function askReason(title, okLabel, required = true) {
  const dlg = $('reasonDlg');
  dlg.innerHTML = `
    <form class="form" id="reasonForm">
      <h2>${esc(title)}</h2>
      <label>사유<textarea name="reason" rows="3" maxlength="300" ${required ? 'required' : ''} placeholder="신청한 사람의 내 예약 화면에 보여요"></textarea></label>
      <div class="actions"><button type="button" class="btn" id="reasonCancel">닫기</button><button class="btn primary">${esc(okLabel)}</button></div>
    </form>`;
  return new Promise(ok => {
    const f = $('reasonForm');
    let answer = null;
    f.onsubmit = ev => { ev.preventDefault(); answer = f.reason.value.trim(); dlg.close(); };
    $('reasonCancel').onclick = () => dlg.close();
    dlg.onclose = () => ok(answer);
    dlg.showModal();
  });
}
const who = b => `${esc(b.userName)}${labName(b.labId) ? ` · ${esc(labName(b.labId))}` : ''}`;

// ---------- 예약 승인 ----------
function renderApprovals(box) {
  const scope = new Set(scopeEquip().map(e => e.id));
  const list = A.upcoming.filter(b => scope.has(b.equipId)).sort((a, b) => a.start - b.start);
  const active = list.filter(b => ACTIVE_ST.has(b.status));
  const pending = list.filter(b => b.status === 'pending');
  const clashes = b => active.filter(o => o.id !== b.id && o.equipId === b.equipId && o.start < b.end && o.end > b.start);
  // 점검·고장 기간에 이미 잡힌 승인된 예약 (자동으로 취소하지 않고 경고만). 승인 대기는 위 목록에 경고가 붙음
  const downHits = active.filter(b => { const e = equipById(b.equipId), d = e && downUntil(e); return b.status === 'approved' && d != null && b.start < d; });
  const sel = prefs.upEquip && scope.has(prefs.upEquip) ? prefs.upEquip : '';
  const upcoming = active.filter(b => b.status === 'approved' && (!sel || b.equipId === sel));

  const card = (b, actions, warn = '') => `
    <div class="item" data-id="${esc(b.id)}">
      <div class="item-main">
        <div class="item-title"><b>${esc(equipById(b.equipId)?.name || '')}</b> <span class="chip ${b.status}">${BOOK_STATUS[b.status]}</span></div>
        <div class="item-sub">${esc(fmtRange(b.start, b.end))} · ${who(b)}${b.createdAt ? ` · 신청 ${esc(fmtDay(b.createdAt))} ${hm(b.createdAt)}` : ''}</div>
        ${b.purpose ? `<div class="item-note">목적: ${esc(b.purpose)}</div>` : ''}
        ${warn}
      </div>
      <div class="item-actions">${actions}</div>
    </div>`;
  const clashWarn = b => {
    const c = clashes(b);
    return c.length ? `<div class="item-warn">⚠ 같은 시간에 겹치는 ${c.map(o => `${esc(o.userName)} ${esc(fmtRange(o.start, o.end))} (${BOOK_STATUS[o.status]})`).join(', ')}</div>` : '';
  };
  const downWarn = b => {
    const e = equipById(b.equipId), d = e && downUntil(e);
    return d != null && b.start < d ? `<div class="item-warn">⚠ ${esc(statusLine(e))}</div>` : '';
  };

  box.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>승인 대기</h2><span class="hint">${pending.length}건 · 같은 시간에 겹치는 신청은 경고가 떠요</span></div>
      ${pending.length ? pending.map(b => card(b, `<button class="btn" data-act="reject">거절</button><button class="btn primary" data-act="approve">승인</button>`, clashWarn(b) + downWarn(b))).join('') : '<p class="empty">승인을 기다리는 신청이 없어요.</p>'}
    </section>
    ${downHits.length ? `
    <section class="panel warn-panel">
      <div class="panel-head"><h2>점검·고장 기간에 잡힌 예약</h2><span class="hint">자동으로 취소되지 않아요. 연락하거나 사유를 적고 취소해 주세요.</span></div>
      ${downHits.map(b => card(b, '<button class="btn" data-act="cancel">취소</button>', downWarn(b))).join('')}
    </section>` : ''}
    <section class="panel">
      <div class="panel-head"><h2>다가오는 예약</h2>
        <select id="upEquip" aria-label="기기"><option value="">모든 기기</option>${scopeEquip().map(e => `<option value="${esc(e.id)}"${e.id === sel ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
      </div>
      ${upcoming.length ? upcoming.map(b => card(b, '<button class="btn" data-act="cancel">취소</button>', clashWarn(b))).join('') : '<p class="empty">다가오는 승인된 예약이 없어요.</p>'}
    </section>`;

  $('upEquip').onchange = ev => { prefs.upEquip = ev.target.value; savePrefs(); ev.target.blur(); renderAdmin(); };
  box.querySelectorAll('[data-act]').forEach(btn => {
    btn.onclick = async () => {
      const b = list.find(x => x.id === btn.closest('.item').dataset.id);
      try {
        if (btn.dataset.act === 'approve') {
          if (clashes(b).some(o => o.status === 'approved') && !confirm('이미 승인된 예약과 겹쳐요. 그래도 승인할까요?')) return;
          await window.cloud.decide(b.id, 'approved');
          toast('승인했어요');
        } else if (btn.dataset.act === 'reject') {
          const reason = await askReason(`${b.userName}님의 신청 거절`, '거절');
          if (reason == null) return;
          await window.cloud.decide(b.id, 'rejected', reason);
          toast('거절했어요');
        } else {
          const reason = await askReason(`${b.userName}님의 예약 취소 (${fmtRange(b.start, b.end)})`, '예약 취소');
          if (reason == null) return;
          await window.cloud.decide(b.id, 'cancelled', reason);
          toast('예약을 취소했어요');
        }
      } catch (e) { fail('처리하지 못했어요', e); }
    };
  });
}
const ACTIVE_ST = new Set(['pending', 'approved']);

// ---------- 가입 승인 (총관리자) ----------
function renderUsers(box) {
  const pend = pendingUsers().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const users = A.users.filter(u => u.role !== 'pending').sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  const labSelect = (u, name) => `<select name="${name}" aria-label="연구실">
      ${u.labId ? '' : '<option value="" selected disabled>연구실 고르기</option>'}
      ${S.labs.map(l => `<option value="${esc(l.id)}"${l.id === u.labId ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}
      ${!u.labId && u.labName ? `<option value="__new">새 연구실로 추가: ${esc(u.labName)}</option>` : ''}
    </select>`;
  const managed = uid => S.equipment.filter(e => (e.managers || []).includes(uid)).map(e => e.name).join(', ');
  box.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>가입 신청</h2><span class="hint">${pend.length}건 · 승인하면 바로 사용자 화면이 열려요</span></div>
      ${pend.length ? pend.map(u => `
        <div class="item" data-uid="${esc(u.id)}">
          <div class="item-main">
            <div class="item-title"><b>${esc(u.name)}</b> <span class="hint">${esc(u.email)}</span></div>
            <div class="item-sub">연구실: ${u.labId ? esc(labName(u.labId) || u.labName) : `직접 입력 '${esc(u.labName)}'`}${u.createdAt ? ` · 신청 ${esc(fmtDay(u.createdAt))}` : ''}</div>
          </div>
          <div class="item-actions">${labSelect(u, 'lab')}<button class="btn" data-act="reject">거절</button><button class="btn primary" data-act="approve">승인</button></div>
        </div>`).join('') : '<p class="empty">새 가입 신청이 없어요.</p>'}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>사용자</h2><span class="hint">${users.length}명 · 기기 담당자는 기기 탭에서 지정해요</span></div>
      <div class="table-wrap"><table class="table users-table">
        <thead><tr><th>이름</th><th>이메일</th><th>연구실</th><th>역할</th><th>담당 기기</th><th>상태</th></tr></thead>
        <tbody>${users.map(u => {
          const me = u.id === S.user.uid;
          return `<tr data-uid="${esc(u.id)}" class="${u.active === false ? 'off' : ''}">
            <td data-k="이름"><b>${esc(u.name)}</b>${me ? ' <span class="chip">나</span>' : ''}</td>
            <td data-k="이메일">${esc(u.email)}</td>
            <td data-k="연구실">${labSelect(u, 'labId')}</td>
            <td data-k="역할"><select name="role"${me ? ' disabled title="내 역할은 바꿀 수 없어요"' : ''}><option value="member"${u.role === 'member' ? ' selected' : ''}>사용자</option><option value="admin"${u.role === 'admin' ? ' selected' : ''}>총관리자</option></select></td>
            <td data-k="담당 기기">${esc(managed(u.id)) || '<span class="hint">-</span>'}</td>
            <td data-k="상태"><label class="check"><input type="checkbox" name="active"${u.active !== false ? ' checked' : ''}${me ? ' disabled' : ''}> 사용 중</label></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </section>`;

  // 가입 신청 승인·거절
  box.querySelectorAll('.item[data-uid] [data-act]').forEach(btn => {
    btn.onclick = async () => {
      const row = btn.closest('.item'), u = A.users.find(x => x.id === row.dataset.uid);
      try {
        if (btn.dataset.act === 'reject') {
          if (!confirm(`${u.name}님의 가입 신청을 거절할까요? 신청 내용이 지워지고, 다시 신청할 수 있어요.`)) return;
          await window.cloud.rejectUser(u.id);
          return toast('가입 신청을 거절했어요');
        }
        let labId = row.querySelector('select[name=lab]').value;
        if (!labId) return toast('연구실을 골라 주세요');
        if (labId === '__new') labId = await labIdFor(u.labName);
        await window.cloud.approveUser(u.id, labId);
        toast(`${u.name}님을 승인했어요`);
      } catch (e) { fail('처리하지 못했어요', e); }
    };
  });
  // 사용자 목록: 바꾸면 바로 저장
  box.querySelectorAll('tr[data-uid]').forEach(tr => {
    const uid = tr.dataset.uid, u = A.users.find(x => x.id === uid);
    tr.querySelector('select[name=labId]').onchange = async ev => {
      let labId = ev.target.value;
      try {
        if (labId === '__new') labId = await labIdFor(u.labName);
        await window.cloud.updateUser(uid, { labId });
        toast('연구실을 바꿨어요');
      } catch (e) { fail('바꾸지 못했어요', e); }
      ev.target.blur();
    };
    tr.querySelector('select[name=role]').onchange = async ev => {
      const role = ev.target.value;
      if (role === 'admin' && !confirm(`${u.name}님을 총관리자로 바꿀까요? 모든 기기·사용자를 관리할 수 있어요.`)) { ev.target.value = u.role; return; }
      try { await window.cloud.updateUser(uid, { role }); toast('역할을 바꿨어요'); } catch (e) { fail('바꾸지 못했어요', e); }
      ev.target.blur();
    };
    tr.querySelector('input[name=active]').onchange = async ev => {
      const active = ev.target.checked;
      if (!active && !confirm(`${u.name}님을 비활성화할까요? 다시 켤 때까지 앱을 쓸 수 없어요.`)) { ev.target.checked = true; return; }
      try { await window.cloud.updateUser(uid, { active }); toast(active ? '다시 쓸 수 있게 했어요' : '비활성화했어요'); } catch (e) { fail('바꾸지 못했어요', e); }
      ev.target.blur();
    };
  });
}

// ---------- 기기 ----------
function renderEquipAdmin(box) {
  const list = scopeEquip();
  box.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>기기</h2><span class="hint">${isAdmin() ? '사용자 화면에서는 공간(호수)별로 묶여 이름순으로 보여요' : '담당 기기의 승인 여부·예약 규칙·상태·매뉴얼을 고칠 수 있어요'}</span>
        ${isAdmin() ? '<button class="btn primary" id="addEquip">기기 추가</button>' : ''}</div>
      ${list.length ? list.map((e, i) => `
        <div class="item" data-id="${esc(e.id)}">
          <div class="item-main">
            <div class="item-title"><b>${esc(e.name)}</b> ${statusChip(e)} <span class="chip ${e.requiresApproval === false ? 'quiet' : 'warn'}">${e.requiresApproval === false ? '바로 확정' : '승인 필요'}</span></div>
            <div class="item-sub">${[e.location && `📍 ${esc(e.location)}`, `👤 ${managerNames(e).length ? esc(managerNames(e).join(', ')) : '담당자 없음'}`].filter(Boolean).join(' · ')}</div>
            ${statusLine(e) ? `<div class="item-warn">⚠ ${esc(statusLine(e))}</div>` : ''}
          </div>
          <div class="item-actions">
            ${isAdmin() ? `<button class="icon-btn small" data-move="-1" title="위로"${i ? '' : ' disabled'}>↑</button><button class="icon-btn small" data-move="1" title="아래로"${i < list.length - 1 ? '' : ' disabled'}>↓</button>` : ''}
            <button class="btn" data-edit>✎ 수정</button>
          </div>
        </div>`).join('') : '<p class="empty">아직 기기가 없어요. 기기 추가로 시작해요.</p>'}
    </section>`;
  $('addEquip')?.addEventListener('click', () => openEquipEdit(null));
  box.querySelectorAll('[data-edit]').forEach(b => { b.onclick = () => openEquipEdit(b.closest('.item').dataset.id); });
  box.querySelectorAll('[data-move]').forEach(b => {
    b.onclick = async () => {
      const ids = list.map(e => e.id), i = ids.indexOf(b.closest('.item').dataset.id), j = i + Number(b.dataset.move);
      [ids[i], ids[j]] = [ids[j], ids[i]];
      try { await window.cloud.reorder('equipment', ids); } catch (e) { fail('순서를 바꾸지 못했어요', e); }
    };
  });
}

const SLOTS = [10, 15, 20, 30, 60, 120];
function openEquipEdit(id) {
  const e = id ? equipById(id) : { name: '', location: '', managers: [], requiresApproval: true, status: 'ok', rules: { slotMinutes: 30 }, manual: { body: '', links: [] } };
  const admin = isAdmin(), r = rulesOf(e);
  const people = A.users.filter(u => u.role !== 'pending' && u.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  const dlg = $('equipEditDlg');
  dlg.innerHTML = `
    <form class="form" id="eqForm" novalidate>
      <h2>${id ? `${esc(e.name)} 수정` : '기기 추가'}</h2>
      <fieldset${admin ? '' : ' disabled'}>
        <legend>기본${admin ? '' : ' (총관리자만 고칠 수 있어요)'}</legend>
        <label>이름<input name="name" maxlength="60" value="${esc(e.name)}" placeholder="예: 공초점 현미경 LSM 900"></label>
        <label><span>위치 <span class="hint">· 첫 단어(호수)가 같은 기기끼리 사용자 화면에서 묶여 보여요</span></span><input name="location" maxlength="80" value="${esc(e.location || '')}" placeholder="예: N469 세포배양실"></label>
        <div class="field-col">담당자 <span class="hint">여러 명 고를 수 있어요</span>
          <div class="pick">${admin ? (people.length ? people.map(u => `<label class="check"><input type="checkbox" name="mgr" value="${esc(u.id)}"${(e.managers || []).includes(u.id) ? ' checked' : ''}> ${esc(u.name)} <span class="hint">${esc(labName(u.labId))}</span></label>`).join('') : '<span class="hint">승인된 사용자가 없어요</span>')
            : esc(managerNames(e).join(', ') || '담당자 없음')}</div>
        </div>
      </fieldset>
      <fieldset>
        <legend>예약</legend>
        <label class="check"><input type="checkbox" name="requiresApproval"${e.requiresApproval !== false ? ' checked' : ''}> 담당자가 승인해야 확정 (끄면 예약하자마자 확정)</label>
        <div class="grid2">
          <label>예약 단위<select name="slotMinutes">${SLOTS.map(m => `<option value="${m}"${m === r.slotMinutes ? ' selected' : ''}>${m}분</option>`).join('')}</select></label>
          <label>1회 최대 시간<input name="maxHours" type="number" min="0.5" step="0.5" value="${r.maxHours ?? ''}" placeholder="제한 없음"></label>
          <label>며칠 앞까지<input name="maxDaysAhead" type="number" min="0" step="1" value="${r.maxDaysAhead ?? ''}" placeholder="제한 없음"></label>
          <span></span>
          <label>예약 가능 시작<input name="openFrom" type="time" value="${r.openFrom || ''}"></label>
          <label>예약 가능 끝<input name="openTo" type="time" value="${r.openTo || ''}"></label>
        </div>
        <p class="hint">비워 두면 제한 없음이에요. 예약 가능 시간대를 비우면 하루 종일 예약할 수 있어요.</p>
      </fieldset>
      <fieldset>
        <legend>상태</legend>
        <div class="seg" id="eqStatus">${Object.entries(STATUS).map(([k, v]) => `<button type="button" data-v="${k}" class="${(e.status || 'ok') === k ? 'on' : ''}">${v}</button>`).join('')}</div>
        <div id="eqDown" class="grid2"${(e.status || 'ok') === 'ok' ? ' hidden' : ''}>
          <label>사유<input name="statusNote" maxlength="80" value="${esc(e.statusNote || '')}" placeholder="예: 레이저 교체"></label>
          <label>언제까지<input name="statusUntil" type="datetime-local" value="${toLocalInput(e.statusUntil)}"></label>
        </div>
        <p class="hint" id="eqDownHint"${(e.status || 'ok') === 'ok' ? ' hidden' : ''}>이 기간에는 새 예약을 받지 않아요. 끝을 비우면 정상으로 바꿀 때까지 막혀요. 이미 잡힌 예약은 예약 승인 탭에 경고로 보여요.</p>
      </fieldset>
      <fieldset>
        <legend>매뉴얼</legend>
        <label>본문<textarea name="body" rows="8" placeholder="사용 순서, 주의할 점… 줄바꿈이 그대로 보여요">${esc(e.manual?.body || '')}</textarea></label>
        <div class="field-col">링크 <span class="hint">PDF·사진은 구글 드라이브 링크로 붙여요</span>
          <div id="eqLinks"></div>
          <button type="button" class="btn" id="eqAddLink">링크 추가</button>
        </div>
      </fieldset>
      <p class="err" id="eqErr"></p>
      <div class="actions">
        ${id && admin ? '<button type="button" class="btn danger" id="eqDelete">기기 삭제</button>' : ''}
        <button type="button" class="btn" id="eqClose">닫기</button><button class="btn primary">저장</button>
      </div>
    </form>`;
  const f = $('eqForm');
  let status = e.status || 'ok';
  $('eqStatus').onclick = ev => {
    const v = ev.target.dataset?.v; if (!v) return;
    status = v; markSeg($('eqStatus'), v);
    $('eqDown').hidden = $('eqDownHint').hidden = v === 'ok';
  };
  const linkRow = (l = {}) => `<div class="row link-row"><input name="lt" placeholder="제목" maxlength="60" value="${esc(l.title || '')}"><input name="lu" placeholder="https://drive.google.com/…" value="${esc(l.url || '')}"><button type="button" class="icon-btn small" title="빼기">✕</button></div>`;
  $('eqLinks').innerHTML = (e.manual?.links || []).map(linkRow).join('');
  $('eqAddLink').onclick = () => $('eqLinks').insertAdjacentHTML('beforeend', linkRow());
  $('eqLinks').onclick = ev => { if (ev.target.closest('.icon-btn')) ev.target.closest('.link-row').remove(); };
  $('eqClose').onclick = () => dlg.close();
  $('eqDelete')?.addEventListener('click', async () => {
    if (!confirm(`'${e.name}' 기기를 삭제할까요? 예약·사용일지 기록은 남지만 화면에서는 더 볼 수 없어요.`)) return;
    try { await window.cloud.deleteEquipment(id); dlg.close(); toast('기기를 삭제했어요'); } catch (x) { fail('삭제하지 못했어요', x); }
  });

  f.onsubmit = async ev => {
    ev.preventDefault();
    const err = m => { $('eqErr').textContent = m; };
    const num = v => (v.trim() === '' ? null : Number(v));
    const rules = { slotMinutes: Number(f.slotMinutes.value), maxHours: num(f.maxHours.value), maxDaysAhead: num(f.maxDaysAhead.value), openFrom: f.openFrom.value || null, openTo: f.openTo.value || null };
    if (admin && !f.name.value.trim()) return err('기기 이름을 적어 주세요.');
    if (rules.maxHours != null && !(rules.maxHours > 0)) return err('1회 최대 시간은 0보다 커야 해요.');
    if (rules.maxDaysAhead != null && !(Number.isInteger(rules.maxDaysAhead) && rules.maxDaysAhead >= 0)) return err('며칠 앞까지는 0 이상의 정수로 적어 주세요.');
    if (!rules.openFrom !== !rules.openTo) return err('예약 가능 시간대는 시작과 끝을 둘 다 적거나 둘 다 비워 주세요.');
    if (rules.openFrom && toMin(rules.openFrom) >= toMin(rules.openTo)) return err('예약 가능 시간대의 끝이 시작보다 뒤여야 해요.');
    const links = [...$('eqLinks').querySelectorAll('.link-row')].map(row => ({ title: row.querySelector('[name=lt]').value.trim(), url: row.querySelector('[name=lu]').value.trim() })).filter(l => l.url);
    const bad = links.find(l => !safeUrl(l.url));
    if (bad) return err(`링크는 http:// 또는 https:// 로 시작해야 해요: ${bad.url}`);
    const down = status !== 'ok';
    // 담당자가 고칠 수 있는 칸 (firestore.rules와 같은 목록)
    const data = {
      requiresApproval: f.requiresApproval.checked, rules,
      status, statusNote: down ? f.statusNote.value.trim() : '', statusUntil: down ? fromLocalInput(f.statusUntil.value) : null,
      manual: { body: f.body.value, links },
    };
    if (admin) {
      const managers = [...f.querySelectorAll('input[name=mgr]:checked')].map(c => c.value);
      Object.assign(data, {
        name: f.name.value.trim(), location: f.location.value.trim(), managers,
        managerNames: Object.fromEntries(managers.map(uid => [uid, A.users.find(u => u.id === uid)?.name || e.managerNames?.[uid] || ''])),
      });
      if (!id) data.order = Math.max(0, ...S.equipment.map(x => x.order ?? 0)) + 1;
    }
    try {
      await window.cloud.saveEquipment(id, data);
      dlg.close();
      toast(id ? '저장했어요' : '기기를 추가했어요');
    } catch (x) { fail('저장하지 못했어요', x); }
  };
  dlg.showModal();
}

// ---------- 사용일지: 기기별 일지 목록, '문제 있었음'은 위로 ----------
const AL = { equipId: '', off: null, logs: [], bookings: [] };
resets.push(() => Object.assign(AL, { equipId: '', off: null, logs: [], bookings: [] }));
function renderLogs(box) {
  const scope = scopeEquip();
  const id = scope.some(e => e.id === prefs.logEquip) ? prefs.logEquip : scope[0]?.id;
  if (!id) { box.innerHTML = '<p class="empty">기기가 없어요.</p>'; return; }
  if (AL.equipId !== id) { // 고른 기기의 일지와 예약(이름·예약 시간을 붙이려고)
    AL.off?.();
    Object.assign(AL, { equipId: id, logs: [], bookings: [] });
    const a = window.cloud.watchEquipLogs(id, list => { AL.logs = list; render(); });
    const b = window.cloud.watchEquipBookings(id, list => { AL.bookings = list; render(); });
    AL.off = () => { a(); b(); };
  }
  const byId = new Map(AL.bookings.map(b => [b.id, b]));
  const logs = AL.logs.slice().sort((a, b) => (b.problem === true) - (a.problem === true) || b.actualStart - a.actualStart);
  const logged = new Set(AL.logs.map(l => l.id)), now = Date.now();
  const missing = AL.bookings.filter(b => b.status === 'approved' && b.end <= now && !logged.has(b.id)).sort((a, b) => b.start - a.start);
  box.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>사용일지</h2>
        <select id="logEquip" aria-label="기기">${scope.map(e => `<option value="${esc(e.id)}"${e.id === id ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
        <span class="hint">${logs.length}건 · 문제 있었음은 위로</span></div>
      ${logs.length ? logs.map(l => {
        const b = byId.get(l.id), moved = b && (b.start !== l.actualStart || b.end !== l.actualEnd);
        return `<div class="item${l.problem ? ' problem' : ''}">
          <div class="item-main">
            <div class="item-title"><b>${esc(b?.userName || '')}</b> <span class="hint">${esc(labName(l.labId))}</span>${l.problem ? ' <span class="chip bad">문제 있었음</span>' : ''}</div>
            <div class="item-sub">사용 ${esc(fmtRange(l.actualStart, l.actualEnd))}${moved ? ` · 예약 ${esc(fmtRange(b.start, b.end))}` : ''}</div>
            ${l.note ? `<div class="item-note">${esc(l.note)}</div>` : ''}
          </div></div>`;
      }).join('') : '<p class="empty">아직 사용일지가 없어요.</p>'}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>사용일지가 없는 지난 예약</h2><span class="hint">${missing.length}건</span></div>
      ${missing.length ? missing.map(b => `<div class="item"><div class="item-main">
          <div class="item-title"><b>${esc(b.userName)}</b> <span class="hint">${esc(labName(b.labId))}</span></div>
          <div class="item-sub">${esc(fmtRange(b.start, b.end))}</div></div></div>`).join('') : '<p class="empty">없어요.</p>'}
    </section>`;
  $('logEquip').onchange = ev => { prefs.logEquip = ev.target.value; savePrefs(); ev.target.blur(); render(); };
}

// ---------- 연구실 (총관리자) ----------
function renderLabs(box) {
  const members = id => A.users.filter(u => u.labId === id && u.role !== 'pending').length;
  const typed = A.users.filter(u => !u.labId && u.labName); // 가입 때 직접 입력한 연구실
  box.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>연구실</h2><span class="hint">가입 폼의 연구실 목록이에요. 이름을 고치면 칸을 벗어날 때 저장돼요.</span></div>
      <form class="row add-row" id="labAdd"><input name="name" maxlength="60" placeholder="새 연구실 이름" required><button class="btn primary">추가</button></form>
      ${S.labs.length ? S.labs.map((l, i) => `
        <div class="item" data-id="${esc(l.id)}">
          <div class="item-main row"><input name="labName" value="${esc(l.name)}" maxlength="60" aria-label="연구실 이름"><span class="hint">${members(l.id)}명</span></div>
          <div class="item-actions">
            <button class="icon-btn small" data-move="-1" title="위로"${i ? '' : ' disabled'}>↑</button><button class="icon-btn small" data-move="1" title="아래로"${i < S.labs.length - 1 ? '' : ' disabled'}>↓</button>
          </div>
        </div>`).join('') : '<p class="empty">아직 연구실이 없어요.</p>'}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>가입 때 직접 입력된 연구실</h2><span class="hint">목록에 추가하거나 있는 연구실에 연결해요</span></div>
      ${typed.length ? typed.map(u => `
        <div class="item" data-uid="${esc(u.id)}">
          <div class="item-main"><div class="item-title"><b>${esc(u.labName)}</b> <span class="hint">${esc(u.name)} · ${u.role === 'pending' ? '가입 대기' : '사용자'}</span></div></div>
          <div class="item-actions">
            <select aria-label="연결할 연구실"><option value="__new">새 연구실로 추가</option>${S.labs.map(l => `<option value="${esc(l.id)}">${esc(l.name)}에 연결</option>`).join('')}</select>
            <button class="btn" data-link>적용</button>
          </div>
        </div>`).join('') : '<p class="empty">정리할 연구실이 없어요.</p>'}
    </section>`;
  $('labAdd').onsubmit = async ev => {
    ev.preventDefault();
    const name = ev.target.name.value.trim();
    if (!name) return;
    try { await window.cloud.addLab(name); ev.target.name.value = ''; ev.target.name.blur(); toast('연구실을 추가했어요'); } catch (x) { fail('추가하지 못했어요', x); }
  };
  box.querySelectorAll('input[name=labName]').forEach(inp => {
    const save = async () => {
      const id = inp.closest('.item').dataset.id, name = inp.value.trim(), old = S.labs.find(l => l.id === id)?.name;
      if (!name || name === old) { inp.value = old; return; }
      try { await window.cloud.updateLab(id, { name }); toast('이름을 바꿨어요'); } catch (x) { fail('바꾸지 못했어요', x); }
    };
    inp.onchange = save;
    inp.onkeydown = ev => { if (ev.key === 'Enter') inp.blur(); };
  });
  box.querySelectorAll('[data-move]').forEach(b => {
    b.onclick = async () => {
      const ids = S.labs.map(l => l.id), i = ids.indexOf(b.closest('.item').dataset.id), j = i + Number(b.dataset.move);
      [ids[i], ids[j]] = [ids[j], ids[i]];
      try { await window.cloud.reorder('labs', ids); } catch (x) { fail('순서를 바꾸지 못했어요', x); }
    };
  });
  box.querySelectorAll('[data-link]').forEach(b => {
    b.onclick = async () => {
      const row = b.closest('.item'), u = A.users.find(x => x.id === row.dataset.uid);
      let labId = row.querySelector('select').value;
      try {
        // 같은 이름으로 직접 입력한 사람들을 한 번에 연결
        if (labId === '__new') labId = await labIdFor(u.labName);
        const same = typed.filter(x => x.labName.trim().toLowerCase() === u.labName.trim().toLowerCase());
        await Promise.all(same.map(x => window.cloud.updateUser(x.id, { labId })));
        toast(`${same.length}명을 연결했어요`);
      } catch (x) { fail('연결하지 못했어요', x); }
    };
  });
}

// ---------- 통계: 월을 고르면 연구실 × 기기 사용 시간 표 (담당자는 담당 기기만) ----------
const ST = { key: '', data: null, loading: false, error: '' };
resets.push(() => Object.assign(ST, { key: '', data: null, loading: false, error: '' }));
function renderStats(box) {
  const scope = scopeEquip();
  const month = prefs.statMonth || ymd(Date.now()).slice(0, 7);
  const from = fromInput(`${month}-01`), to = monthStart(from + 32 * DAY);
  const key = `${month}|${scope.map(e => e.id).join(',')}`;
  if (ST.key !== key) { // 월이나 기기가 바뀌면 다시 받음
    Object.assign(ST, { key, data: null, loading: true, error: '' });
    window.cloud.getUsage(scope.map(e => e.id), from, to)
      .then(d => { if (ST.key === key) Object.assign(ST, { data: d, loading: false }); })
      .catch(e => { console.error(e); if (ST.key === key) Object.assign(ST, { loading: false, error: e.code || e.message }); })
      .finally(() => { if (prefs.adminTab === 'stats') render(); });
  }
  const shift = n => { const [y, m] = month.split('-').map(Number), d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };
  let table = '<p class="hint">불러오는 중이에요…</p>';
  if (ST.error) table = `<p class="err">통계를 불러오지 못했어요 (${esc(ST.error)})</p>`;
  else if (ST.data) {
    const cells = usageTable(ST.data.bookings, ST.data.logs);
    const labIds = [...S.labs.map(l => l.id), ''].filter(id => scope.some(e => cells.has(`${id}|${e.id}`)));
    const cell = c => (c && (c.log || c.book) ? `<b>${hours(c.log + c.book)}</b><small>일지 ${hours(c.log)} · 예약 ${hours(c.book)}</small>` : '<span class="hint">-</span>');
    table = labIds.length ? `<div class="table-wrap"><table class="table stats">
      <thead><tr><th>연구실</th>${scope.map(e => `<th>${esc(e.name)}</th>`).join('')}<th>합계</th></tr></thead>
      <tbody>${labIds.map(id => `<tr><th>${esc(labName(id) || '연구실 없음')}</th>${scope.map(e => `<td>${cell(cells.get(`${id}|${e.id}`))}</td>`).join('')}<td class="sum">${cell(sumCells(scope.map(e => cells.get(`${id}|${e.id}`))))}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th>합계</th>${scope.map(e => `<td class="sum">${cell(sumCells(labIds.map(id => cells.get(`${id}|${e.id}`))))}</td>`).join('')}<td class="sum">${cell(sumCells([...cells.values()]))}</td></tr></tfoot>
    </table></div>` : '<p class="empty">이 달에 끝난 승인된 예약이 없어요.</p>';
  }
  box.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>통계</h2>
        <div class="bk-nav"><button class="icon-btn" id="stPrev" title="이전 달">‹</button><input type="month" id="stMonth" value="${month}"><button class="icon-btn" id="stNext" title="다음 달">›</button><button class="icon-btn small" id="stReload" title="새로 고침">↻</button></div>
        <span class="hint">단위 시간 · 사용일지가 있으면 실제 시간(일지), 없으면 승인된 예약 시간(예약) · 끝난 예약만, 시작한 달 기준</span>
      </div>
      ${table}
    </section>`;
  const go = m => { prefs.statMonth = m; savePrefs(); render(); };
  $('stPrev').onclick = () => go(shift(-1));
  $('stNext').onclick = () => go(shift(1));
  $('stMonth').onchange = ev => { if (ev.target.value) { ev.target.blur(); go(ev.target.value); } };
  $('stReload').onclick = () => { ST.key = ''; render(); };
}

// ---------- 데이터: 전체 백업 파일 저장 (총관리자) ----------
function renderData(box) {
  box.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>백업</h2></div>
      <p>사용자·연구실·기기·예약·사용일지를 JSON 파일 하나로 받아요. 가끔 받아서 안전한 곳에 두세요.</p>
      <p class="hint">파일에는 이름·이메일 같은 개인정보가 들어 있어요. 저장소(GitHub)에는 올리지 마세요.</p>
      <div class="actions" style="justify-content:flex-start"><button class="btn primary" id="backupBtn">백업 파일 저장</button><span class="hint" id="backupInfo"></span></div>
    </section>`;
  $('backupBtn').onclick = async () => {
    $('backupBtn').disabled = true;
    try {
      const data = await window.cloud.backup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `equip-med-backup-${ymd(Date.now())}.json` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      $('backupInfo').textContent = ['users', 'labs', 'equipment', 'bookings', 'logs'].map(k => `${k} ${data[k].length}`).join(' · ');
      toast('백업 파일을 저장했어요');
    } catch (e) { fail('백업하지 못했어요', e); }
    finally { $('backupBtn').disabled = false; }
  };
}
