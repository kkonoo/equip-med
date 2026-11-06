// 동인동 공동기기 넣기 (한 번만): 경북대 의대 연구기기현황(2026.10)의 동인동 기기 52개를 equipment에 추가해요.
// 쓰는 법: admin.html을 총관리자로 연 뒤 브라우저 콘솔(F12 → Console)에  await import('./tools/import-dongin.js')  을 입력해요.
// - 같은 이름의 기기가 이미 있으면 건너뛰어요 (여러 번 실행해도 두 개가 되지 않음).
//   예전 버전으로 넣어 링크가 목록 페이지(SRC)인 기기는, 그 링크만 기기별 페이지로 바꿔요.
// - 담당자는 비어 있고(앱에 가입한 뒤 기기 탭에서 지정), 모두 '승인 필요' · 예약 단위 30분으로 들어가요.
// - 목록은 lab-manager js/equip.js 의 SHARED_EQUIPS '동인동 공동기기'를 그대로 옮김 (출처 https://med.knu.ac.kr/pages/sub.htm?nav_code=knu1670414710)
//   매뉴얼 본문 = 설명 · 모델 · 위치 · 구분 · 담당 · 이용 방법. 이용 방법에 시간(09:00–17:00 등)이 있으면 예약 가능 시간대로 넣음.
//   knu = 의대 홈페이지의 기기 번호(idx). 같은 기기가 두 번 올라간 것(초고속·고속원심분리기, QuantStudio 5)은 이용 방법이 적힌 쪽.
const KIND = '공동기기실 장비', OWNER = '정지연 053-420-4989 jiyean98@knu.ac.kr';
const SRC = 'https://med.knu.ac.kr/pages/sub.htm?nav_code=knu1670414710';
const LINK = '의대 홈페이지 기기 정보';
const knuUrl = n => `${SRC}&mode=view&mv_data=${btoa(`idx=${n}&table=cs_booking_equipment`)}`;
const ITEMS = [
  { name: 'NanoDrop (분광광도계)', desc: '1–2 µL만으로 핵산·단백질 농도와 순도(흡광도)를 재는 분광광도계', model: 'Nano Drop Ultra', maker: 'thermo', place: 'N402', knu: 576 },
  { name: 'TissueLyser (조직파쇄기)', desc: '비드로 조직·세포 여러 시료를 한 번에 갈아 균질화 (RNA·DNA·단백질 추출 전 처리)', model: 'Tissue Lyser III', maker: 'Qiagen', place: 'N469', knu: 575 },
  { name: 'Body composition NMR (핵자기공명분석기)', desc: '살아 있는 마우스의 체지방·제지방·체액량을 재는 NMR 체성분 분석기', model: 'minispec LF50', maker: 'Bruker', place: '실험동물자원관리센터', spot: '2층', knu: 560 },
  { name: 'Gamma counter (감마카운터기)', desc: '튜브 시료의 감마선 방사능(¹²⁵I 등)을 세는 감마 카운터', model: 'Wizard2', maker: 'PerkinElmer', place: 'N138', knu: 559 },
  { name: 'Phosphor imager Typhoon (화상분석시스템)', desc: '방사성 동위원소로 감광한 이미징 플레이트(IP)를 읽는 phosphor imager', model: 'Typhoon IP', maker: 'cytiva', place: 'N139', spot: '동위원소 실험실', knu: 558 },
  { name: 'Analytical balance (분석용전자저울)', desc: '0.1 mg 단위까지 재는 분석용 저울', model: 'ML104T', place: 'N138', spot: '동위원소실 안 N142호', knu: 557 },
  { name: 'Refrigerated microcentrifuge (탁상형냉장원심분리기)', desc: '1.5·2 mL 튜브용 냉장 마이크로원심분리기', model: 'CN/FC5515R', maker: 'Ohaus', place: 'N138', spot: '동위원소실', knu: 556 },
  { name: 'X-ray film processor (필름현상기)', desc: '웨스턴·방사선 X-ray 필름을 자동으로 현상', model: 'SRX 101A', maker: 'kodak', place: 'N139', knu: 555 },
  { name: 'Ultracentrifuge 2023 (초고속원심분리기)', desc: '최대 100,000 rpm으로 돌려 엑소좀·바이러스·세포소기관 등을 분리하는 초고속 원심분리기', model: 'Optima XE-100', maker: 'beckman', place: 'N139', knu: 554 },
  { name: 'Freeze dryer (동결건조기)', desc: '시료를 얼린 뒤 진공에서 수분을 날려 말리는 동결건조기', model: 'FD8518', maker: '일신', place: 'N408', knu: 551 },
  { name: 'Holotomography Tomocube (홀로그램현미경)', desc: '염색 없이 살아 있는 세포를 3D로 보는 홀로토모그래피 현미경 (형광도 같이)', model: 'HT-2H', maker: 'TOMOCUBE', place: 'N408', knu: 550 },
  { name: 'Single-cell analyzer BD Rhapsody (DNA 서열 분석기)', desc: '단일세포 분석(scRNA-seq 등)용 세포 포획·바코딩 시스템 — 홈페이지 이름은 ‘DNA 서열 분석기’', model: 'Rhapsody-HT', maker: 'BD', place: 'N402', knu: 549 },
  { name: 'Clinical chemistry analyzer (임상화학자동분석장치)', desc: '혈청·혈장의 생화학 수치(간·신장 기능 등)를 자동으로 재는 분석기', model: 'Vitros XT3400', maker: 'Johnson & Johnson', place: 'N402', knu: 548 },
  { name: 'Flow cytometer CytoFLEX (유세포분석기)', desc: '형광 표지한 세포를 하나씩 재는 다색 유세포분석기 (분석 전용)', model: 'CytoFLEX', maker: 'Beckman', place: 'N469', knu: 547 },
  { name: 'Holotomography Nanolive (세포단층촬영 현미경)', desc: '염색 없이 살아 있는 세포의 3D 구조를 보는 홀로토모그래피 현미경', model: '3D cell explorer', maker: 'Nanolive', place: 'N469', knu: 546 },
  { name: 'Live-cell imager IncuCyte (실시간세포분석기)', desc: '인큐베이터 안에서 세포를 자동으로 계속 찍어 증식·이동(wound healing) 등을 보는 장비', model: 'Incucyte zoom', maker: 'essen bioscience', place: 'N469', knu: 545 },
  { name: 'Cryostat CM3050S (냉동조직박절기)', desc: '냉동 조직을 얇게 잘라 절편을 만드는 크라이오스탯', model: 'CM3050S', maker: 'Leica', place: 'N469', knu: 544 },
  { name: 'Plate reader FlexStation 3 (형광리더기)', desc: '96·384-well 플레이트의 흡광·형광·발광을 재는 리더 (피펫 내장 — 시약을 넣으며 바로 측정)', model: 'FlexStation 3', maker: 'Molecular Device/US', place: 'N469', knu: 543 },
  { name: 'qPCR QuantStudio 3 (실시간 유전자 증폭기)', desc: '증폭되는 양을 실시간으로 재는 qPCR (96-well)', model: 'QuantStudio3', maker: 'Thermo', place: 'N469', how: '장비 앞 예약대장에 예약 후 사용, 처음이면 사용자 교육 후 사용', knu: 541 },
  { name: 'Inverted fluorescence microscope THUNDER (형광현미경)', desc: '배양 세포를 아래에서 보는 도립 형광현미경 (THUNDER로 흐림을 걷어 선명)', model: 'DMi 8 - THUNDER', maker: 'Leica', place: 'N469', how: '담당자 교육 후 사용, 장비 앞 예약대장에 예약 후 사용, 사용 후 사용대장 기입', knu: 540 },
  { name: 'Cell sorter FACSAria Fusion (유세포분석기)', desc: '형광으로 원하는 세포를 골라 따로 모으는 세포 분리기(sorter)', model: 'FACS Aria Fusion', maker: 'Becton Dickinson', place: 'N401', how: '오퍼레이터 예약 후 사용', knu: 539 },
  { name: 'Flow cytometer FACSCalibur (유세포분석기)', desc: '형광 표지한 세포를 재는 구형 4색 유세포분석기', model: 'FACS Calibur', maker: 'Becton Dickinson', place: 'N401', how: '오퍼레이터 예약 후 이용, 사용 시간 09:00–17:00', knu: 538 },
  { name: 'Plate reader SpectraMax M2e (형광리더기)', desc: '플레이트·큐벳의 흡광·형광·발광을 파장을 바꿔 가며 재는 리더', model: 'Spectramax M2e', maker: 'Molecular Device/US', place: 'N469', how: '사용자가 직접 사용, 처음이면 장비 교육 후 사용', knu: 537 },
  { name: 'Ultrapure water system (초순수제조장치)', desc: '실험용 초순수(Type 1)를 바로 받아 쓰는 장치 (UV 살균)', model: 'Direct-Q5UV', maker: 'Millipore', place: 'N139', how: '사용자가 직접 사용', knu: 536 },
  { name: 'Confocal microscope STELLARIS 5 (공초점현미경)', desc: '형광 시료를 층층이 선명하게 찍는 공초점 현미경', model: 'STELLARIS5', maker: 'Leica', place: 'N408', how: '오퍼레이터 예약 후 이용 (직접 사용 불가, 쓰기 전 장비 사양 확인), 09:00–17:00, 주말·공휴일 불가', knu: 535 },
  { name: 'Nanoparticle tracking analyzer (입자측정장치)', desc: '엑소좀 같은 나노입자를 하나씩 추적해 크기·농도를 재는 장비 (NTA)', model: 'NTA Pro', maker: 'Malvern', place: 'N402', how: '담당 오퍼레이터에게 전화 예약, 교육 받은 사람만 직접 사용, 의과대학 안에서만, 평일 09:00–18:00', knu: 534 },
  { name: 'Multispectral imaging system (멀티스펙트럼 형광영상분석시스템)', desc: '파장별로 찍어 겹치는 형광·자가형광을 분리(unmixing)하는 이미징 시스템', model: 'Nuance FX', maker: 'Perkin Elmer', place: 'N469', how: '예약대장에 예약 후 사용, 사용 후 기기 사용대장 기입', knu: 510 },
  { name: 'Ultracentrifuge 2015 (초고속원심분리기)', desc: '최대 100,000 rpm으로 돌려 엑소좀·바이러스·세포소기관 등을 분리하는 초고속 원심분리기', model: 'Optima XE-100', maker: 'Beckman Coulter', place: 'N139', how: '담당자에게 전화로 예약 후 이용, 처음이면 담당자에게 교육 후 사용', knu: 509 },
  { name: 'High-speed centrifuge (고속원심분리기)', desc: '큰 부피 시료를 최대 26,000 rpm으로 돌리는 바닥형 고속 원심분리기', model: 'Avanti JXN-26', maker: 'Beckman Coulter', place: 'N139', how: '담당자에게 전화로 예약 후 이용, 사용 후 기기 사용대장 기입, 처음이면 담당자에게 교육 후 사용', knu: 508 },
  { name: 'qPCR QuantStudio 5 (실시간 유전자 증폭기)', desc: '증폭되는 양을 실시간으로 재는 qPCR (96/384-well 블록 교체)', model: 'QuantStudio5', maker: 'thermo science', place: 'N469', how: '예약대장에 예약 후 사용, 사용 후 기기 사용대장 기입', knu: 507 },
  { name: 'Veterinary hematology analyzer (동물 혈구 분석기)', desc: '동물 혈액의 혈구 수(적혈구·백혈구·혈소판 등, CBC)를 재는 분석기', model: 'SCI-VET', maker: 'Scil', place: 'N402', how: '사용 전 예약, 사용 후 기기 사용대장 기입, 처음이면 담당자에게 교육 후 사용', knu: 506 },
  { name: 'Chemi imager FUSION (케미닥)', desc: '웨스턴 블롯(화학발광)·겔을 카메라로 찍는 이미저', model: 'FUSION', maker: 'Vilber', place: 'N408', how: '사용 후 기기 사용대장 기입, 처음이면 담당자에게 교육 후 사용', knu: 505 },
  { name: 'Telemetry blood pressure monitor (소동물혈압계)', desc: '쥐에 넣은 무선 송신기로 혈압 등을 계속 재는 텔레메트리 장치', model: 'TRM54PB', maker: 'Kaha Sciences (New Zealand)', place: '실험동물자원관리센터', knu: 504 },
  { name: 'Confocal microscope LSM 5 Exciter (공초점현미경)', desc: '형광 시료를 층층이 선명하게 찍는 공초점 현미경 (2008년 도입)', model: 'LSM5 Exciter', maker: 'Zeiss', place: 'N469', how: 'operator 분석 장비 — 담당자에게 예약 후 사용, 예약대장에 예약, 사용 후 기기 사용대장 기입', knu: 499 },
  { name: 'Upright fluorescence microscope (형광현미경)', desc: '슬라이드 표본을 위에서 보는 정립 형광현미경', model: 'Axio Imager A1', maker: 'Zeiss', place: 'N469', how: '교육 후 사용, 문 앞 예약대장에 예약, 사용대장 꼭 기입', knu: 498 },
  { name: 'Dose calibrator (선량 측정계)', desc: '방사성 시료의 방사능 양을 재는 측정기 (dose calibrator)', model: 'CRC-712m', maker: 'Capintec', place: '신관 동위원소실', kind: '연구기기', knu: 533 },
  { name: 'Autoclave (고압멸균기)', desc: '고온·고압 증기로 기구·배지·폐기물을 멸균 (65 L)', model: 'ST-65G, 65L', maker: '제이오텍', place: 'N371', spot: '기능학실습실B', how: '학생 실습이 없는 기간에 예약 후 사용', kind: '연구기기', knu: 532 },
  { name: 'Plate reader SpectraMax i3x (마이크로플레이트리더)', desc: '플레이트의 흡광·형광·발광을 재는 멀티모드 리더', model: 'Spectramax i3x (US)', maker: 'Molecular Devices', place: 'N371', spot: '기능학실습실B', how: '학생 실습이 없는 기간에 예약 후 사용', kind: '연구기기', knu: 531 },
  { name: 'Phase contrast microscope (위상차현미경)', desc: '염색하지 않은 표본도 명암 차로 보는 위상차 현미경', model: 'ECLIPSE Ci-S (JP)', maker: 'Nikon', place: 'N327', spot: '형태학실습실', how: '학생 실습이 없는 기간에 예약 후 사용', kind: '연구기기', knu: 530 },
  { name: 'Stereo microscope (실체현미경)', desc: '표본을 낮은 배율에서 입체로 보는 현미경', model: 'E-400 (5각, JP)', maker: 'Nikon', place: 'N327', spot: '형태학실습실', how: '학생 실습이 없는 기간에 예약 후 사용', kind: '연구기기', knu: 529 },
  { name: 'Gel imager Gel Doc XR (겔다큐멘테이션시스템)', desc: 'UV로 DNA·단백질 겔을 비춰 찍는 겔 이미징 장치', model: 'Gel Doc XR system (170-8170, US)', maker: 'Bio-Rad', place: 'N371', spot: '기능학실습실B', how: '학생 실습이 없는 기간에 예약 후 사용', kind: '연구기기', knu: 528 },
  { name: 'Refrigerated microcentrifuge (미량냉장원심분리기)', desc: '1.5·2 mL 튜브용 냉장 마이크로원심분리기', model: 'Smart R17, 1.5mL×18/24', maker: '한일과학산업', place: 'N371·N471', spot: '기능학실습실 B·C', how: '학생 실습이 없는 기간에 예약 후 사용', kind: '연구기기', knu: 527 },
  { name: 'Microcentrifuge (미량원심분리기)', desc: '1.5·2 mL 튜브용 마이크로원심분리기 (상온)', model: '5424 (DE)', maker: 'Eppendorf', place: 'N371·N471', spot: '기능학실습실 B·C', how: '학생 실습이 없는 기간에 예약 후 사용', kind: '연구기기', knu: 526 },
  { name: 'Probe sonicator (균질기)', desc: '초음파로 세포를 깨거나 DNA를 자르는 초음파 균질기 (probe sonicator)', model: 'VC505, 500W (US)', maker: 'Sonics and Materials', place: 'N471', spot: '기능학실습실C', how: '학생 실습이 없는 기간에 예약 후 사용', kind: '연구기기', knu: 525 },
  { name: 'Fluorescence microscope AX70 (형광도립현미경)', desc: '형광 표지한 표본을 보는 형광현미경', model: 'AX70 (JP)', maker: 'Olympus', place: '350호', kind: '연구기기', knu: 519 },
  { name: 'Laser Doppler flowmeter (혈류 측정기)', desc: '레이저 도플러로 조직의 혈류를 재는 장치 (광섬유 바늘 프로브)', model: 'ML192 & fiber optic needle probe', maker: 'AD Instruments', place: '343호', kind: '연구기기', knu: 517 },
  { name: 'Cryostat MEV (냉동조직박편절단기)', desc: '냉동 조직을 얇게 잘라 절편을 만드는 크라이오스탯', model: 'MEV 3832', maker: 'Sakura', place: '343호', kind: '연구기기', knu: 516 },
  { name: 'UV-Vis spectrophotometer (자외선 분광분석기)', desc: '큐벳에 담은 시료의 자외선·가시광 흡광도를 재는 분광광도계', model: 'UV-1650PC', maker: 'Shimadzu', place: 'N107-2', kind: '연구기기', knu: 514 },
  { name: 'Fraction collector (분액수집기)', desc: '크로마토그래피(FPLC)에서 나오는 용출액을 튜브에 나눠 받는 장치', model: 'Frac-950', maker: 'GE', place: '신관 공동기기실', kind: '연구기기', knu: 513 },
  { name: 'Mass spectrometer (질량분석기)', desc: '나노 LC로 분리한 펩타이드 등의 질량을 재는 LC-MS/MS (단백체 분석)', model: 'nanoUPLC Q-Tof Premier', maker: 'Waters', place: 'N107', kind: '연구기기', knu: 512 },
  { name: 'HPLC (고속액체크로마토그라프)', desc: '물질을 분리·정제하는 HPLC', model: 'Delta 600', maker: 'Waters', place: '사이클로트론실', kind: '연구기기', knu: 511 },
  { name: 'Cryostat CM1850 (냉동조직박절기)', desc: '냉동 조직을 얇게 잘라 절편을 만드는 기본형 크라이오스탯', model: 'CM1850', maker: 'Leica', place: 'N147', kind: '연구기기', knu: 501 },
];

function toEquip(i) {
  const hours = (i.how || '').match(/(\d{2}:\d{2})–(\d{2}:\d{2})/);
  const where = [i.place, i.spot].filter(Boolean).join(' ');
  const body = [
    i.desc, '',
    `모델: ${[i.model, i.maker].filter(Boolean).join(' · ')}`,
    `위치: ${where}`,
    `구분: ${i.kind || KIND}`,
    `담당: ${i.owner || OWNER}`,
    ...(i.how ? [`이용 방법: ${i.how}`] : []),
    '', '출처: 경북대 의대 연구기기현황 (2026.10)',
  ].join('\n');
  return {
    name: i.name, location: where, managers: [], managerNames: {}, requiresApproval: true,
    rules: { slotMinutes: 30, maxHours: null, maxDaysAhead: null, openFrom: hours?.[1] || null, openTo: hours?.[2] || null },
    status: 'ok', statusNote: '', statusUntil: null,
    manual: { body, links: [{ title: LINK, url: knuUrl(i.knu) }] },
  };
}

if (!window.cloud || !isAdmin()) {
  alert('총관리자로 로그인한 관리자 페이지(admin.html)에서 실행해 주세요.');
} else {
  const have = new Map(S.equipment.map(e => [e.name, e]));
  const todo = ITEMS.filter(x => !have.has(x.name));
  const relink = ITEMS.filter(x => have.get(x.name)?.manual?.links?.some(l => l.url === SRC));
  const ask = [
    todo.length && `동인동 공동기기 ${todo.length}개를 넣어요.${todo.length < ITEMS.length ? ` (이미 있는 ${ITEMS.length - todo.length}개는 건너뜀)` : ''}\n담당자는 비어 있고, 모두 '승인 필요'로 들어가요.`,
    relink.length && `이미 있는 ${relink.length}개의 링크를 목록 페이지에서 기기별 페이지로 바꿔요.`,
  ].filter(Boolean).join('\n\n');
  if (!ask) toast('동인동 공동기기는 이미 다 들어 있어요');
  else if (confirm(`${ask}\n\n진행할까요?`)) {
    let order = Math.max(0, ...S.equipment.map(e => e.order ?? 0)), done = 0, fixed = 0;
    try {
      for (const x of todo) { await window.cloud.saveEquipment(null, { ...toEquip(x), order: ++order }); done++; }
      for (const x of relink) {
        const e = have.get(x.name);
        const links = e.manual.links.map(l => (l.url === SRC ? { title: LINK, url: knuUrl(x.knu) } : l));
        await window.cloud.saveEquipment(e.id, { manual: { ...e.manual, links } }); fixed++;
      }
      toast([done && `${done}개를 넣었어요`, fixed && `${fixed}개의 링크를 바꿨어요`].filter(Boolean).join(' · '));
    } catch (e) { fail(`${done}개 넣고 ${fixed}개 링크를 바꾸다 멈췄어요`, e); }
  }
}
