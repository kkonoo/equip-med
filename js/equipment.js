// 기기 탭: 기기 카드 목록, 누르면 매뉴얼 본문·링크·예약 규칙 → 바로 예약하기
function renderEquipment() {
  const box = $('tab-equip');
  if (!S.equipment.length) {
    box.innerHTML = `<p class="empty">${esc(isAdmin() ? t('아직 등록된 기기가 없어요. 관리자 페이지 > 기기에서 추가할 수 있어요.') : t('아직 등록된 기기가 없어요. 총관리자가 추가하면 여기에 보여요.'))}</p>`;
    return;
  }
  // 같은 공간(위치의 첫 단어)끼리 묶고, 카드에는 위치의 나머지만
  box.innerHTML = byPlace(S.equipment).map(([place, list]) => `
    <section class="eq-group">
      <h2 class="eq-place">📍 ${place ? esc(place) : t('위치 없음')} <span class="hint">${list.length}</span></h2>
      <div class="eq-grid">${list.map(e => `
    <button type="button" class="eq-card panel" data-id="${esc(e.id)}">
      ${photoOf(e) ? `<img class="eq-photo" src="${esc(photoOf(e))}" alt="" loading="lazy">` : '<span class="eq-photo none" aria-hidden="true">📷</span>'}
      <span class="eq-text">
      <span class="eq-head"><b>${esc(e.name)}</b>${statusChip(e)}</span>
      ${placeRest(e) ? `<span class="hint">${esc(placeRest(e))}</span>` : ''}
      <span class="hint">👤 ${managerNames(e).length ? esc(managerNames(e).join(', ')) : t('담당자 없음')}</span>
      ${statusLine(e) ? `<span class="hint warn-text">⚠ ${esc(statusLine(e))}</span>` : ''}
      <span class="chips"><span class="chip ${e.requiresApproval === false ? 'quiet' : 'warn'}">${e.requiresApproval === false ? t('바로 확정') : t('승인 필요')}</span>${trainChip(e)}</span>
      </span>
    </button>`).join('')}</div>
    </section>`).join('');
  box.querySelectorAll('.eq-card').forEach(b => { b.onclick = () => openEquip(b.dataset.id); });
}

// 교육이 필요한 기기: 내가 교육 받았는지
const trainChip = e => (!e.requiresTraining ? '' : trainedOf(e) ? `<span class="chip ok">🎓 ${t('교육 받음')}</span>` : `<span class="chip warn">🎓 ${t('교육 필요')}</span>`);
function trainNotice(e) {
  if (!e.requiresTraining) return '';
  const tr = trainedOf(e);
  return tr ? `<p class="hint">🎓 ${esc(t('{date} 교육 받음', { date: tr.date }))}</p>`
    : `<p class="notice">🎓 ${esc(t('교육 기록이 없어요. 처음 쓰는 기기라면 교육을 먼저 받아요. 매뉴얼의 문의처나 담당자에게 연락해요.'))}</p>`;
}

function openEquip(id) {
  const e = equipById(id);
  if (!e) return;
  const links = (e.manual?.links || []).filter(l => safeUrl(l.url));
  $('equipDlg').innerHTML = `
    <form method="dialog" class="form">
      <h2 class="dlg-title">${esc(e.name)} ${statusChip(e)}</h2>
      ${photoOf(e) ? `<img class="dlg-photo" src="${esc(photoOf(e))}" alt="${esc(e.name)}">` : ''}
      <p class="hint">${[e.location && `📍 ${esc(e.location)}`, `👤 ${managerNames(e).length ? esc(managerNames(e).join(', ')) : t('담당자 없음')}`].filter(Boolean).join(' · ')}</p>
      ${statusLine(e) ? `<p class="notice">⚠ ${esc(statusLine(e))}</p>` : ''}
      ${trainNotice(e)}
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
