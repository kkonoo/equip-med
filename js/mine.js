// 내 예약 탭: 다가오는 예약과 지난 예약. 상태 칩(승인 대기, 승인, 거절+사유, 취소),
// 시작 전엔 취소, 끝난 예약엔 사용일지 쓰기 버튼과 미작성 표시
const mine = { list: [], logs: new Map(), off: null };
resets.push(() => Object.assign(mine, { list: [], logs: new Map(), off: null }));

function renderMine() {
  if (!mine.off) {
    const a = window.cloud.watchMine(list => { mine.list = list; if (prefs.tab === 'mine') renderMine(); });
    const b = window.cloud.watchMyLogs(list => { mine.logs = new Map(list.map(l => [l.id, l])); if (prefs.tab === 'mine') renderMine(); });
    mine.off = () => { a(); b(); };
  }
  const now = Date.now();
  const upcoming = mine.list.filter(b => b.end > now).sort((a, b) => a.start - b.start);
  const past = mine.list.filter(b => b.end <= now).sort((a, b) => b.start - a.start);
  const noLog = past.filter(b => b.status === 'approved' && !mine.logs.has(b.id));
  const eqName = b => esc(equipById(b.equipId)?.name || '삭제된 기기');
  const reason = b => (b.reason && (b.status === 'rejected' || b.status === 'cancelled') ? `<div class="item-note">사유: ${esc(b.reason)}</div>` : '');
  const card = (b, actions = '', extra = '') => `
    <div class="item" data-id="${esc(b.id)}">
      <div class="item-main">
        <div class="item-title"><b>${eqName(b)}</b> <span class="chip ${b.status}">${BOOK_STATUS[b.status]}</span>${extra}</div>
        <div class="item-sub">${esc(fmtRange(b.start, b.end))}${b.purpose ? ` · ${esc(b.purpose)}` : ''}</div>
        ${reason(b)}
      </div>
      <div class="item-actions">${actions}</div>
    </div>`;
  $('tab-mine').innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>다가오는 예약</h2><span class="hint">${upcoming.length}건</span></div>
      ${upcoming.length ? upcoming.map(b => card(b, b.start > now && ACTIVE.has(b.status) ? '<button class="btn" data-act="cancel">취소</button>' : '')).join('')
        : '<p class="empty">다가오는 예약이 없어요. 예약 탭에서 빈 칸을 눌러 예약해요.</p>'}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>지난 예약</h2><span class="hint">${noLog.length ? `사용일지를 안 쓴 예약 ${noLog.length}건` : '사용일지를 다 썼어요'}</span></div>
      ${past.length ? past.map(b => {
        if (b.status !== 'approved') return card(b);
        const log = mine.logs.get(b.id);
        return card(b,
          log ? '<button class="btn" data-act="log">✎ 사용일지</button>' : '<button class="btn primary" data-act="log">사용일지 쓰기</button>',
          log ? (log.problem ? ' <span class="chip bad">문제 있었음</span>' : ' <span class="chip ok">일지 씀</span>') : ' <span class="chip warn">미작성</span>');
      }).join('') : '<p class="empty">지난 예약이 없어요.</p>'}
    </section>`;
  $('tab-mine').querySelectorAll('[data-act]').forEach(btn => {
    btn.onclick = async () => {
      const b = mine.list.find(x => x.id === btn.closest('.item').dataset.id);
      if (btn.dataset.act === 'log') return openLogDlg(b);
      if (!confirm(`${equipById(b.equipId)?.name || ''} ${fmtRange(b.start, b.end)} 예약을 취소할까요?`)) return;
      try { await window.cloud.cancelMine(b.id); toast('예약을 취소했어요'); } catch (e) { fail('취소하지 못했어요', e); }
    };
  });
}

// 사용일지 창: 실제 시작·종료(예약 시간으로 미리 채움), 특이사항, '문제 있었음'
function openLogDlg(b) {
  const log = mine.logs.get(b.id);
  const dlg = $('logDlg');
  dlg.innerHTML = `
    <form class="form" id="logForm">
      <h2>사용일지</h2>
      <p class="hint">${esc(equipById(b.equipId)?.name || '')} · 예약 ${esc(fmtRange(b.start, b.end))}</p>
      <div class="grid2">
        <label>실제 시작<input type="datetime-local" name="s" required value="${toLocalInput(log?.actualStart ?? b.start)}"></label>
        <label>실제 종료<input type="datetime-local" name="e" required value="${toLocalInput(log?.actualEnd ?? b.end)}"></label>
      </div>
      <label>특이사항<textarea name="note" rows="4" maxlength="1000" placeholder="예: 488 레이저 출력이 평소보다 낮았어요">${esc(log?.note || '')}</textarea></label>
      <label class="check"><input type="checkbox" name="problem"${log?.problem ? ' checked' : ''}> 문제 있었음 (담당자 화면에 위로 보여요)</label>
      <p class="err" id="logErr"></p>
      <div class="actions"><button type="button" class="btn" id="logClose">닫기</button><button class="btn primary">저장</button></div>
    </form>`;
  const f = $('logForm');
  $('logClose').onclick = () => dlg.close();
  f.onsubmit = async ev => {
    ev.preventDefault();
    const s = fromLocalInput(f.s.value), e = fromLocalInput(f.e.value);
    if (!(e > s)) { $('logErr').textContent = '실제 종료가 시작보다 뒤여야 해요.'; return; }
    try {
      await window.cloud.saveLog(b, { actualStart: s, actualEnd: e, note: f.note.value.trim(), problem: f.problem.checked }, !log);
      dlg.close();
      toast('사용일지를 저장했어요');
    } catch (x) { fail('저장하지 못했어요', x); }
  };
  dlg.showModal();
}
