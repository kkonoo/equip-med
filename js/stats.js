// 연구실 × 기기 사용 시간 계산 (관리자 페이지 통계 탭)
// 사용 시간 = 사용일지가 있으면 실제 시간(일지 기준), 없으면 승인된 예약 시간(예약 기준). 끝난 예약만 셈
// bookings: 그 달에 시작한 예약, logs: 같은 기기들의 사용일지 (id = 예약 id)
function usageTable(bookings, logs, now = Date.now()) {
  const logBy = new Map(logs.map(l => [l.id, l]));
  const cells = new Map(); // `${labId}|${equipId}` → { log: ms, book: ms }
  for (const b of bookings) {
    if (b.status !== 'approved' || b.end > now) continue;
    const key = `${b.labId || ''}|${b.equipId}`;
    const c = cells.get(key) || { log: 0, book: 0 };
    const l = logBy.get(b.id);
    if (l) c.log += Math.max(0, l.actualEnd - l.actualStart);
    else c.book += b.end - b.start;
    cells.set(key, c);
  }
  return cells;
}
const sumCells = list => list.reduce((s, c) => ({ log: s.log + (c?.log || 0), book: s.book + (c?.book || 0) }), { log: 0, book: 0 });
const hours = ms => Math.round(ms / HOUR * 10) / 10;
