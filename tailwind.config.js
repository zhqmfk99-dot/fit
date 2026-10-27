import colors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'

// ── 다크 모드 색상표 ──────────────────────────────────────────────
// bg-gray-100, text-gray-800, border-red-50 같은 기존 클래스를 그대로 두고, 색 값만 CSS 변수로 바꿔서 한 곳에서 라이트/다크를 전환한다.
//  - 라이트(기본) 값은 Tailwind 원래 색을 그대로 읽어 오므로(tailwindcss/colors) 웹앱·기존 화면의 색은 달라지지 않는다.
//  - 다크는 <html class="dark">일 때만 적용된다. PWA(/mobile) 화면에서만 이 클래스를 붙인다(App.jsx의 MobileApp) — 웹앱은 항상 라이트.
//  - 같은 색이라도 배경·테두리(s)와 글자(t)는 다크에서 필요한 값이 달라서(예: 어두운 버튼 배경 vs 어두운 글자) 따로 둔다.
// 형식: 계열 → 단계 → { s: 다크의 배경·테두리·링 색, t: 다크의 글자 색 }  (rgb 세 값, 생략하면 라이트와 동일)
const NEUTRAL = {
  50: { s: '38 50 69', t: '241 245 249' },
  100: { s: '51 65 85', t: '226 232 240' },
  200: { s: '71 85 105', t: '203 213 225' },
  300: { s: '91 105 126', t: '148 163 184' },
  400: { s: '100 116 139', t: '148 163 184' },
  500: { s: '100 116 139', t: '163 176 196' },
  600: { s: '71 85 105', t: '203 213 225' },
  700: { s: '71 85 105', t: '226 232 240' },
  800: { s: '71 85 105', t: '241 245 249' },
  900: { s: '51 65 85', t: '248 250 252' },
}
const DARK = {
  gray: NEUTRAL,
  slate: NEUTRAL,
  blue: { 50: { s: '26 42 74' }, 100: { s: '30 58 138' }, 200: { s: '30 64 175' }, 500: { t: '96 165 250' }, 600: { t: '96 165 250' } },
  red: { 50: { s: '69 26 32' }, 100: { s: '91 33 38' }, 200: { s: '127 29 29' }, 300: { t: '252 165 165' }, 400: { t: '252 165 165' }, 500: { t: '248 113 113' }, 600: { t: '252 129 129' }, 700: { t: '252 165 165' } },
  orange: { 50: { s: '67 38 20' }, 100: { s: '94 52 20' }, 200: { s: '124 45 18' }, 500: { t: '251 146 60' }, 600: { t: '251 146 60' }, 700: { t: '253 186 116' } },
  emerald: { 50: { s: '20 58 47' }, 100: { s: '6 78 59' }, 500: { t: '52 211 153' }, 600: { t: '52 211 153' }, 700: { t: '110 231 183' }, 800: { t: '167 243 208' } },
  green: { 50: { s: '20 83 45' }, 100: { s: '20 83 45' }, 600: { t: '74 222 128' }, 700: { t: '134 239 172' } },
  violet: { 50: { s: '46 29 84' }, 600: { t: '167 139 250' } },
  teal: { 50: { s: '17 63 61' }, 500: { t: '45 212 191' } },
  sky: { 50: { s: '14 56 84' }, 700: { t: '125 211 252' } },
  indigo: { 50: { s: '40 38 94' }, 500: { t: '129 140 248' }, 600: { t: '165 180 252' } },
  amber: { 50: { s: '66 45 14' }, 100: { s: '92 62 16' }, 600: { t: '251 191 36' }, 700: { t: '252 211 77' } },
  yellow: { 50: { s: '66 56 14' }, 100: { s: '92 78 16' }, 600: { t: '250 204 21' }, 700: { t: '253 224 71' } },
}

const hexToRgb = hex => {
  const h = hex.replace('#', '')
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)).join(' ')
}
const ref = (kind, name) => `rgb(var(--${kind}-${name}) / <alpha-value>)`

const surface = {} // bg-*, border-*, ring-*, divide-* 가 쓰는 색
const text = {} // text-* 가 쓰는 색
const rootVars = {} // 라이트 (기본)
const darkVars = {} // 다크 (html.dark)
for (const [family, shades] of Object.entries(DARK)) {
  surface[family] = {}
  text[family] = {}
  for (const [shade, d] of Object.entries(shades)) {
    const light = hexToRgb(colors[family][shade])
    surface[family][shade] = ref('s', `${family}-${shade}`)
    text[family][shade] = ref('t', `${family}-${shade}`)
    rootVars[`--s-${family}-${shade}`] = light
    rootVars[`--t-${family}-${shade}`] = light
    darkVars[`--s-${family}-${shade}`] = d.s ?? light
    darkVars[`--t-${family}-${shade}`] = d.t ?? light
  }
}
// 카드 배경(white)과 화면 배경(letusBg)은 배경으로만 바꾼다. 글자 text-white(버튼 위 흰 글씨)는 다크에서도 그대로 흰색이어야 한다.
surface.white = ref('s', 'white')
surface.letusBg = ref('s', 'letusBg')
rootVars['--s-white'] = '255 255 255'
rootVars['--s-letusBg'] = '245 247 250'
darkVars['--s-white'] = '30 41 59'
darkVars['--s-letusBg'] = '15 23 42'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // html.dark 규칙(다크 색 변수)이 "안 쓰이는 클래스"로 정리되지 않게 한다 — dark 클래스는 코드(classList.toggle)로 붙이기 때문
  safelist: ['dark'],
  theme: {
    extend: {
      colors: {
        letusBg: '#f5f7fa',
        letusSidebar: '#273444',
        letusBlue: '#4b89ff',
        letusOrange: '#f58220',
      },
      backgroundColor: surface,
      borderColor: surface,
      ringColor: surface,
      divideColor: surface,
      textColor: text,
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
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': rootVars,
        'html.dark': { ...darkVars, 'color-scheme': 'dark' },
      })
    }),
  ],
}
