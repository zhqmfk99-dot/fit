// 운동 가이드(신체도·자세 영상 검색) — 웹앱·PWA 공용 로직(UI 아님)
//   · 영상은 DB에 넣지 않고, 운동 이름으로 유튜브 검색 결과를 새 창으로 연다(키·서버 불필요).
//     검색 결과 목록을 여는 것이라 "가장 좋은 영상"을 골라 주지는 않고, 영상 내용·품질은 보증하지 못한다.
//   · 신체도는 운동 리스트의 근육 정보(muscles)를 그대로 쓴다. 근육이 주동근인지 보조근인지는 구분하지 않고 같은 색으로 칠한다.

// 검색어: "<운동 이름> 운동 자세" (이름이 이미 "운동"으로 끝나면 "운동"이 두 번 들어가지 않게 "<이름> 자세")
export const youtubeGuideUrl = name => {
  const n = String(name).trim()
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(n.endsWith('운동') ? `${n} 자세` : `${n} 운동 자세`)}`
}

// 스트레칭·워밍업 동작 검색어: "<동작 이름> 방법" (lib/stretchGuide.js의 동작에 쓴다)
export const youtubeHowToUrl = name => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${String(name).trim()} 방법`)}`

export const GUIDE_COLOR = '#2563eb'

// react-body-highlighter에 넘길 데이터(없으면 빈 배열 → 몸통만 그린다)
export const highlighterData = muscles => (muscles?.length ? [{ name: 'target', muscles, frequency: 1 }] : [])
