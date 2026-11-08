// Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹)의 firebaseConfig 값. null 이면 '설정이 필요해요' 안내만 보여요.
// (이 값은 공개돼도 괜찮아요. 데이터 보호는 firestore.rules가 담당)
// 프로젝트 equip-knumed — 다른 앱(플래너·살림노트·랩 매니저)과 다른 프로젝트
export const firebaseConfig = {
  apiKey: 'AIzaSyAjzBq4oKbwkERDKbKCe4bF2xoi4R0YryA',
  authDomain: 'equip-knumed.firebaseapp.com',
  projectId: 'equip-knumed',
  storageBucket: 'equip-knumed.firebasestorage.app',
  messagingSenderId: '861542181704',
  appId: '1:861542181704:web:766aceaeb0eabc97b8a17d',
};
// 매뉴얼 파일 올리기: tools/drive-upload.gs 를 Apps Script 웹 앱으로 배포한 주소 (…/exec). null 이면 '파일 올리기' 버튼이 없어요
export const manualUploadUrl = null;
