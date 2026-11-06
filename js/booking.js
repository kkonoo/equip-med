// 예약 탭: 기기를 고르면 주간 그리드(가로 요일, 세로 시간). 900px 이하에서는 하루 보기.
// 빈 칸 → 예약 창(시작·종료를 누른 칸으로 미리 채움), 예약 칸 → 누가·언제 (내 예약이면 취소)
// 칸 표시: 승인된 예약, 승인 대기(연하게), 내 예약(accent), 점검·고장 기간(빗금, 예약 불가), 예약 불가 시간(회색)
const bk = {
  anchor: Date.now(),   // 보고 있는 날 (이 날이 든 주 또는 이 날 하루)
  sub: null, subKey: '',
  list: [],             // 고른 기기의 예약 (end > 보는 기간 시작)
  scrollFor: '',        // 이 기기로 처음 그릴 때만 '예약 시작 시간'으로 스크롤
};
resets.push(() => Object.assign(bk, { sub: null, subKey: '', list: [] }));
const narrow = matchMedia('(max-width: 900px)');
narrow.addEventListener('change', () => { if (prefs.tab === 'book') render(); });
const ACTIVE = new Set(['pending', 'approved']); // 시간을 차지하는 상태

function bkEquip() {
  const e = equipById(prefs.equipId) || S.equipment[0];
  if (e && prefs.equipId !== e.id) { prefs.equipId = e.id; savePrefs(); }
  return e;
}
function bkRange() {
  const days = narrow.matches ? 1 : 7;
  const from = days === 7 ? weekStart(bk.anchor) : dayStart(bk.anchor);
  return { from, to: from + days * DAY, days };
}

function renderBooking() {
  const box = $('tab-book');
  const e = bkEquip();
  if (!e) { box.innerHTML = '<p class="empty">아직 등록된 기기가 없어요.</p>'; return; }
  const { from, to, days } = bkRange();
  // 실시간 구독: 기기나 보는 기간이 바뀌면 다시
  const key = `${e.id}|${from}`;
  if (bk.subKey !== key) {
    bk.sub?.();
    bk.subKey = key;
    bk.list = [];
    bk.sub = window.cloud.watchBookings(e.id, from, list => { bk.list = list; if (prefs.tab === 'book' && shown === 'app') renderBooking(); });
  }

  const r = rulesOf(e);
  const slot = r.slotMinutes;
  const slotPx = Math.max(22, Math.round(44 * slot / 60));
  const hourPx = slotPx * 60 / slot;
  const now = Date.now(), today = dayStart(now);
  const oldScroll = box.querySelector('.bk-scroll')?.scrollTop;

  const dayList = Array.from({ length: days }, (_, i) => from + i * DAY);
  const label = days === 7 ? `${fmtDay(from)} – ${fmtDay(to - DAY)}` : fmtDay(from);
  box.innerHTML = `
    <div class="bk-bar">
      <select id="bkEquip" aria-label="기기">${S.equipment.map(x => `<option value="${esc(x.id)}"${x.id === e.id ? ' selected' : ''}>${esc(x.name)}${x.status && x.status !== 'ok' ? ` (${STATUS[x.status]})` : ''}</option>`).join('')}</select>
      ${statusChip(e)}
      <span class="chip ${e.requiresApproval === false ? 'quiet' : 'warn'}">${e.requiresApproval === false ? '바로 확정' : '승인 필요'}</span>
      <span class="spacer"></span>
      <div class="bk-nav">
        <button class="icon-btn" id="bkPrev" title="이전">‹</button>
        <button class="btn" id="bkToday">오늘</button>
        <button class="icon-btn" id="bkNext" title="다음">›</button>
        <b class="bk-label">${label}</b>
      </div>
    </div>
    ${statusLine(e) ? `<p class="notice">⚠ ${esc(statusLine(e))}</p>` : ''}
    <p class="hint bk-rules">${ruleList(e).map(esc).join(' · ')}</p>
    <div class="bk-grid panel" style="--days:${days}; --hour:${hourPx}px; --slotpx:${slotPx}px">
      <div class="bk-head"><div></div>${dayList.map(d => { const p = kp(d); return `<div class="day-h${d === today ? ' today' : ''}${p.dow === 0 ? ' sun' : p.dow === 6 ? ' sat' : ''}">${DOW[p.dow]} <b>${p.m}/${p.d}</b></div>`; }).join('')}</div>
      <div class="bk-scroll">
        <div class="bk-body">
          <div class="bk-times">${Array.from({ length: 24 }, (_, h) => `<div>${h ? `${pad(h)}:00` : ''}</div>`).join('')}</div>
          ${dayList.map(d => `<div class="bk-col" data-day="${d}">${blocksFor(e, d, hourPx, now)}</div>`).join('')}
        </div>
      </div>
    </div>
    <div class="legend">
      <span><i class="sw approved"></i>승인</span><span><i class="sw pending"></i>승인 대기</span>
      <span><i class="sw mine"></i>내 예약</span><span><i class="sw down"></i>점검·고장</span><span><i class="sw closed"></i>예약 불가</span>
    </div>`;

  const sc = box.querySelector('.bk-scroll');
  if (bk.scrollFor !== e.id || oldScroll == null) {
    bk.scrollFor = e.id;
    sc.scrollTop = Math.max(0, (r.openFrom ? toMin(r.openFrom) / 60 : 8) * hourPx - 8);
  } else sc.scrollTop = oldScroll;

  $('bkEquip').onchange = ev => { prefs.equipId = ev.target.value; savePrefs(); renderBooking(); };
  const step = days * DAY;
  $('bkPrev').onclick = () => { bk.anchor -= step; renderBooking(); };
  $('bkNext').onclick = () => { bk.anchor += step; renderBooking(); };
  $('bkToday').onclick = () => { bk.anchor = Date.now(); renderBooking(); };
  box.querySelectorAll('.bk-col').forEach(col => {
    col.onclick = ev => {
      const b = ev.target.closest('.bk');
      if (b) return openBookingInfo(b.dataset.id);
      const y = ev.clientY - col.getBoundingClientRect().top;
      const start = Number(col.dataset.day) + Math.floor(y / slotPx) * slot * MIN;
      const why = blockedReason(e, start, start + slot * MIN);
      if (why) return toast(why);
      openBookingDlg(e, start, start + slot * MIN);
    };
  });
}

// 하루 칸 안의 회색·빗금 영역과 예약 칸 HTML
function blocksFor(e, day, hourPx, now) {
  const r = rulesOf(e), end = day + DAY, out = [];
  const px = ms => (ms - day) / HOUR * hourPx;
  const area = (cls, s, t, text = '') => {
    s = Math.max(s, day); t = Math.min(t, end);
    if (t > s) out.push(`<div class="blk ${cls}" style="top:${px(s)}px;height:${px(t) - px(s)}px">${text}</div>`);
  };
  if (r.openFrom && r.openTo) { area('closed', day, day + toMin(r.openFrom) * MIN); area('closed', day + toMin(r.openTo) * MIN, end); }
  if (r.maxDaysAhead != null) area('closed', dayStart(now) + (r.maxDaysAhead + 1) * DAY, end);
  const down = downUntil(e);
  if (down != null) area('down', now, down, `<span>${STATUS[e.status]}</span>`);
  area('past', day, now);

  // 예약 칸: 겹치면 나란히 (줄 나누기)
  const items = bk.list
    .filter(b => ACTIVE.has(b.status) && b.start < end && b.end > day)
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map(b => ({ b, s: Math.max(b.start, day), t: Math.min(b.end, end) }));
  const lanes = [];
  for (const it of items) {
    let i = lanes.findIndex(t => t <= it.s);
    if (i < 0) { i = lanes.length; lanes.push(0); }
    lanes[i] = it.t; it.lane = i;
  }
  for (const it of items) {
    const { b } = it, mine = b.uid === S.user.uid;
    const n = items.filter(o => o.s < it.t && o.t > it.s).reduce((m, o) => Math.max(m, o.lane + 1), it.lane + 1);
    const who = mine ? '내 예약' : `${b.userName}${labName(b.labId) ? ` · ${labName(b.labId)}` : ''}`;
    out.push(`<button type="button" class="bk ${b.status}${mine ? ' mine' : ''}" data-id="${esc(b.id)}"
      style="top:${px(it.s)}px;height:${Math.max(px(it.t) - px(it.s), 14)}px;--lane:${it.lane};--lanes:${n}"
      title="${esc(`${who} · ${fmtRange(b.start, b.end)} · ${BOOK_STATUS[b.status]}`)}">
      <b>${esc(who)}</b><span>${hm(b.start)}–${b.end === dayStart(b.start) + DAY ? '24:00' : hm(b.end)}${b.status === 'pending' ? ' · 승인 대기' : ''}</span></button>`);
  }
  if (day === dayStart(now)) out.push(`<div class="now-line" style="top:${px(now)}px"></div>`);
  return out.join('');
}

// 이 시간을 예약할 수 없는 이유 (없으면 null). 겹침은 따로 확인
function blockedReason(e, start, end) {
  const r = rulesOf(e), now = Date.now(), slotMs = r.slotMinutes * MIN;
  if (!(end > start)) return '종료가 시작보다 뒤여야 해요.';
  if (start < Math.floor(now / slotMs) * slotMs || end <= now) return '이미 지난 시간이에요.';
  const down = downUntil(e);
  if (down != null && start < down) {
    return down === Infinity ? `${STATUS[e.status]} 중이라 예약할 수 없어요.` : `${STATUS[e.status]} 중이라 ${fmtDay(down)} ${hm(down)}까지는 예약할 수 없어요.`;
  }
  if ((start - dayStart(start)) % slotMs || (end - dayStart(end)) % slotMs) return `예약 단위(${r.slotMinutes}분)에 맞춰 주세요.`;
  if (r.maxDaysAhead != null && dayStart(start) > dayStart(now) + r.maxDaysAhead * DAY) return `오늘부터 ${r.maxDaysAhead}일 뒤까지만 예약할 수 있어요.`;
  if (r.maxHours && end - start > r.maxHours * HOUR) return `한 번에 ${r.maxHours}시간까지 예약할 수 있어요.`;
  if (r.openFrom && r.openTo) {
    const d = dayStart(start), from = d + toMin(r.openFrom) * MIN, to = d + toMin(r.openTo) * MIN;
    if (start < from || end > to) return `예약 가능 시간(${r.openFrom}–${r.openTo}) 안에서만 예약할 수 있어요.`;
  }
  return null;
}
const overlaps = (list, start, end, skipId) => list.filter(b => b.id !== skipId && ACTIVE.has(b.status) && b.start < end && b.end > start);

// ---------- 예약 창 ----------
function timeOptions(slot, withEnd) {
  const out = [];
  for (let m = 0; m < 1440; m += slot) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  if (withEnd) out.push('24:00');
  return out.map(t => `<option>${t}</option>`).join('');
}
function openBookingDlg(e, start, end) {
  const r = rulesOf(e), approval = e.requiresApproval !== false;
  const endIs24 = hm(end) === '00:00';
  const dlg = $('bookDlg');
  dlg.innerHTML = `
    <form class="form" id="bookForm">
      <h2>${esc(e.name)} ${approval ? '예약 신청' : '예약'}</h2>
      <p class="hint">${ruleList(e).map(esc).join(' · ')}</p>
      <div class="grid2">
        <label>시작 날짜<input type="date" name="sDate" required value="${ymd(start)}"></label>
        <label>시작 시각<select name="sTime">${timeOptions(r.slotMinutes)}</select></label>
        <label>종료 날짜<input type="date" name="eDate" required value="${ymd(endIs24 ? end - MIN : end)}"></label>
        <label>종료 시각<select name="eTime">${timeOptions(r.slotMinutes, true)}</select></label>
      </div>
      <label>사용 목적<input name="purpose" maxlength="100" placeholder="예: 세포 이미징 (형광 3채널)"></label>
      <p class="hint">사용 목적은 본인과 담당자·총관리자 화면에만 보여요.</p>
      <p class="err" id="bookErr"></p>
      <div class="actions"><button type="button" class="btn" id="bookCancel">닫기</button><button class="btn primary" id="bookSubmit">${approval ? '신청' : '예약'}</button></div>
    </form>`;
  const f = $('bookForm');
  f.sTime.value = hm(start);
  f.eTime.value = endIs24 ? '24:00' : hm(end);
  $('bookCancel').onclick = () => dlg.close();
  f.onsubmit = async ev => {
    ev.preventDefault();
    const s = fromInput(f.sDate.value, f.sTime.value), t = fromInput(f.eDate.value, f.eTime.value);
    const err = msg => { $('bookErr').textContent = msg; };
    const cur = equipById(e.id) || e; // 창을 연 사이에 규칙·상태가 바뀌었을 수 있음
    const why = blockedReason(cur, s, t);
    if (why) return err(why);
    $('bookSubmit').disabled = true;
    try {
      // 저장 직전에 서버에서 한 번 더: 같은 기기의 승인 대기·승인된 예약과 겹치면 막음
      const clash = overlaps(await window.cloud.findOverlaps(e.id, s, t), s, t);
      if (clash.length) return err(`그 시간에 다른 예약이 있어요: ${clash.map(b => `${b.userName} ${fmtRange(b.start, b.end)}`).join(', ')}`);
      await window.cloud.createBooking({ equipId: e.id, start: s, end: t, purpose: f.purpose.value.trim(), status: cur.requiresApproval === false ? 'approved' : 'pending' });
      dlg.close();
      toast(cur.requiresApproval === false ? '예약했어요' : '신청했어요. 담당자가 승인하면 확정돼요');
    } catch (x) { fail('예약하지 못했어요', x); }
    finally { $('bookSubmit').disabled = false; }
  };
  dlg.showModal();
}

// ---------- 예약 칸을 누르면 ----------
function openBookingInfo(id) {
  const b = bk.list.find(x => x.id === id);
  if (!b) return;
  const e = equipById(b.equipId), mine = b.uid === S.user.uid;
  const showPurpose = mine || (e && manages(e)); // 사용 목적은 본인·담당자·총관리자만
  const dlg = $('bookInfoDlg');
  dlg.innerHTML = `
    <form method="dialog" class="form">
      <h2 class="dlg-title">${mine ? '내 예약' : '예약'} <span class="chip ${b.status}">${BOOK_STATUS[b.status]}</span></h2>
      <dl class="kv">
        <dt>기기</dt><dd>${esc(e?.name || '')}</dd>
        <dt>시간</dt><dd>${esc(fmtRange(b.start, b.end))}</dd>
        <dt>이름</dt><dd>${esc(b.userName)}</dd>
        <dt>연구실</dt><dd>${esc(labName(b.labId) || '-')}</dd>
        ${showPurpose ? `<dt>사용 목적</dt><dd>${esc(b.purpose || '-')}</dd>` : ''}
      </dl>
      <div class="actions">
        ${mine && Date.now() < b.start ? '<button type="button" class="btn danger" id="infoCancel">예약 취소</button>' : ''}
        ${!mine && e && manages(e) ? '<a class="btn" href="admin.html">관리자 페이지에서 처리</a>' : ''}
        <button class="btn primary">닫기</button>
      </div>
    </form>`;
  $('infoCancel')?.addEventListener('click', async () => {
    if (!confirm('이 예약을 취소할까요?')) return;
    try { await window.cloud.cancelMine(b.id); dlg.close(); toast('예약을 취소했어요'); }
    catch (x) { fail('취소하지 못했어요', x); }
  });
  dlg.showModal();
}
