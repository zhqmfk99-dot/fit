// 신체 기록의 측정 기기(집 체중계 / 정밀 측정) — 웹앱·PWA 공용 로직(UI 아님).
// 기계마다 체지방률·근육량이 다르게 나오므로, 정밀 측정(보건소·체육관 인바디 등) 기록은 "지금 값·추세·목표 진행" 계산에서 빼고
// 그래프에 다른 모양으로, 기록 화면에 라벨로 따로 보여 준다. 날짜당 기록은 한 건이라 한 날짜에 두 기기를 같이 적을 수는 없다.

export const SOURCE_HOME = 'home'
export const SOURCE_PRECISE = 'precise'
export const SOURCE_OPTIONS = [
  { value: SOURCE_HOME, label: '집 체중계' },
  { value: SOURCE_PRECISE, label: '정밀 측정' },
]
export const SOURCE_HINT = '보건소·체육관 인바디처럼 정밀한 기계로 잰 값이면 "정밀 측정"을 고르세요. 집 체중계 기록과 섞여 추세가 튀지 않게 계산에서는 빠지고 그래프에 따로 표시돼요.'

// 알 수 없는 값은 집 체중계로 본다(예전 기록·칼럼이 없는 DB)
export const normalizeSource = v => (v === SOURCE_PRECISE ? SOURCE_PRECISE : SOURCE_HOME)
export const isPrecise = r => normalizeSource(r?.source) === SOURCE_PRECISE
export const sourceLabel = v => SOURCE_OPTIONS.find(o => o.value === normalizeSource(v)).label

// 어떤 지표(key)의 기록 중 계산에 쓸 것: 집 체중계 기록이 하나라도 있으면 그것만, 그 지표가 정밀 측정에만 있으면 정밀 측정 기록을 대신 쓴다.
// (지표별로 따로 판단한다 — 체중은 집 체중계로, 체지방률이 정밀 측정에만 있으면 그걸로 계산)
export function recordsForCalc(records, key) {
  const withKey = (records ?? []).filter(r => r?.[key] != null)
  const home = withKey.filter(r => !isPrecise(r))
  return home.length ? home : withKey
}
