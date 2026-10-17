/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        letusBg: '#f5f7fa',
        letusSidebar: '#273444',
        letusBlue: '#4b89ff',
        letusOrange: '#f58220',
      },
      // 웹앱 글자 크기 표준 (CLAUDE.md 참고). 새 화면은 text-xs/sm/lg 대신 이 토큰을 쓴다.
      fontSize: {
        'ui-title': ['14px', '20px'], // 카드·섹션 제목, 년월
        'ui-body': ['11px', '16px'], // 본문, 버튼, 요일, 날짜
        'ui-caption': ['10px', '14px'], // 보조 설명, 뱃지, 건수
        // PWA(모바일) 글자 크기 표준 (CLAUDE.md 참고). 터치 화면이라 웹앱보다 크게 잡는다.
        'm-title': ['15px', '22px'], // 카드·섹션 제목, 숫자 강조
        'm-body': ['13px', '18px'], // 본문, 버튼, 입력
        'm-caption': ['11px', '16px'], // 보조 설명, 뱃지, 범례, 축 라벨
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
