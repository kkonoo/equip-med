// 기기 탭: 기기 카드 목록, 누르면 매뉴얼 본문·링크·예약 규칙 → 바로 예약하기
function renderEquipment() {
  const box = $('tab-equip');
  if (!S.equipment.length) {
    box.innerHTML = `<p class="empty">${esc(isAdmin() ? t('아직 등록된 기기가 없어요. 관리자 페이지 > 기기에서 추가할 수 있어요.') : t('아직 등록된 기기가 없어요. 총관리자가 추가하면 여기에 보여요.'))}</p>`;
    return;
  }
  box.innerHTML = `<div class="eq-grid">${S.equipment.map(e => `
    <button type="button" class="eq-card panel" data-id="${esc(e.id)}">
      <span class="eq-head"><b>${esc(e.name)}</b>${statusChip(e)}</span>
      ${e.location ? `<span class="hint">📍 ${esc(e.location)}</span>` : ''}
      <span class="hint">👤 ${managerNames(e).length ? esc(managerNames(e).join(', ')) : t('담당자 없음')}</span>
      ${statusLine(e) ? `<span class="hint warn-text">⚠ ${esc(statusLine(e))}</span>` : ''}
      <span class="chips"><span class="chip ${e.requiresApproval === false ? 'quiet' : 'warn'}">${e.requiresApproval === false ? t('바로 확정') : t('승인 필요')}</span></span>
    </button>`).join('')}</div>`;
  box.querySelectorAll('.eq-card').forEach(b => { b.onclick = () => openEquip(b.dataset.id); });
}

function openEquip(id) {
  const e = equipById(id);
  if (!e) return;
  const links = (e.manual?.links || []).filter(l => safeUrl(l.url));
  $('equipDlg').innerHTML = `
    <form method="dialog" class="form">
      <h2 class="dlg-title">${esc(e.name)} ${statusChip(e)}</h2>
      <p class="hint">${[e.location && `📍 ${esc(e.location)}`, `👤 ${managerNames(e).length ? esc(managerNames(e).join(', ')) : t('담당자 없음')}`].filter(Boolean).join(' · ')}</p>
      ${statusLine(e) ? `<p class="notice">⚠ ${esc(statusLine(e))}</p>` : ''}
      <section>
        <h3>${t('매뉴얼')}</h3>
        ${e.manual?.body ? `<div class="manual">${esc(e.manual.body)}</div>` : `<p class="hint">${t('아직 매뉴얼이 없어요.')}</p>`}
      </section>
      ${links.length ? `<section><h3>${t('링크')}</h3><ul class="links">${links.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">🔗 ${esc(l.title || l.url)}</a></li>`).join('')}</ul></section>` : ''}
      <section>
        <h3>${t('예약 규칙')}</h3>
        <ul class="rules">${ruleList(e).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      </section>
      <div class="actions"><button class="btn">${t('닫기')}</button><button type="button" class="btn primary" id="equipBookBtn">${t('예약하기')}</button></div>
    </form>`;
  $('equipBookBtn').onclick = () => {
    $('equipDlg').close();
    prefs.equipId = id; savePrefs();
    window.goTab('book');
  };
  $('equipDlg').showModal();
}
