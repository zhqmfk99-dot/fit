// 내 목표(목표 체중·목표 체지방률·목표일) — 웹앱·PWA 공용 로직(UI 아님), AI 아닌 규칙.
// 같은 신체 기록·목표면 항상 같은 결과다. 신체 기록은 불규칙하게 쌓이므로 순번이 아니라 **날짜**를 기준으로 계산한다.
//
// 아래 기준 숫자(최근 30일·3개 평균, 추세 60일, 감량 필요 크기 구간 등)는 흔히 쓰는 값으로 정한 **가정**이다.
// 체중계·체성분계 값은 하루하루 오차가 커서 마지막 한 값이 아니라 최근 몇 개의 평균을 "현재"로 본다.

const DAY_MS = 86400000
const RECENT_DAYS = 30 // "현재 값"에 쓰는 기록 범위
const RECENT_COUNT = 3 // 그 안에서 마지막 몇 개의 평균을 쓸지
const TREND_DAYS = 60 // 추세(주당 변화)를 보는 범위
const TREND_MIN_POINTS = 3
const TREND_MIN_SPAN_DAYS = 14 // 기록들이 이 기간 이상에 걸쳐 있어야 추세를 본다
const BASELINE_DAYS = 180 // 진행률의 시작 값을 찾는 범위
const PROJECT_MAX_DAYS = 730 // 도달 예상일이 이보다 멀면 보여주지 않는다
// AI에 보낼 힌트의 크기 구간(현재 − 목표). 체지방률은 %p, 체중은 kg
const CUT_FAT_BIG = 6
const CUT_FAT_MID = 2
const CUT_WEIGHT_BIG = 8
const CUT_WEIGHT_MID = 3
const GAIN_WEIGHT_BIG = 8
const GAIN_WEIGHT_MID = 3

export const GOAL_LIMITS = { weightMin: 20, weightMax: 300, fatMin: 3, fatMax: 60 }

const pad = n => String(n).padStart(2, '0')
export const todayStr = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const dayNum = s => {
  const [y, m, d] = s.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}
const addDays = (s, n) => {
  const d = new Date(dayNum(s) * DAY_MS + n * DAY_MS)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
const round1 = n => Math.round(n * 10) / 10

// 오늘까지의 기록 중 이 지표 값이 있는 것(날짜 오름차순)
const series = (records, key, today) =>
  records
    .filter(r => r[key] != null && Number.isFinite(Number(r[key])) && r.date && r.date <= today)
    .map(r => ({ date: r.date, v: Number(r[key]) }))
    .sort((a, b) => a.date.localeCompare(b.date))

// 현재 값: 최근 30일 안의 마지막 3개 평균. 30일 안에 기록이 없으면 마지막 값을 쓰고 stale=true.
export function currentValue(records, key, now = new Date()) {
  const today = todayStr(now)
  const rs = series(records, key, today)
  if (!rs.length) return null
  const last = rs[rs.length - 1]
  const recent = rs.filter(r => dayNum(today) - dayNum(r.date) <= RECENT_DAYS)
  if (!recent.length) return { value: round1(last.v), date: last.date, count: 1, stale: true, daysAgo: dayNum(today) - dayNum(last.date) }
  const used = recent.slice(-RECENT_COUNT)
  return { value: round1(used.reduce((s, r) => s + r.v, 0) / used.length), date: last.date, count: used.length, stale: false, daysAgo: dayNum(today) - dayNum(last.date) }
}

// 추세: 최근 60일 기록을 날짜 기준으로 직선에 맞춰 주당 변화량을 낸다. 기록이 3개 미만이거나 2주 이상에 걸쳐 있지 않으면 null.
export function trendPerWeek(records, key, now = new Date()) {
  const today = todayStr(now)
  const pts = series(records, key, today).filter(r => dayNum(today) - dayNum(r.date) <= TREND_DAYS)
  if (pts.length < TREND_MIN_POINTS) return null
  const xs = pts.map(p => dayNum(p.date))
  const span = xs[xs.length - 1] - xs[0]
  if (span < TREND_MIN_SPAN_DAYS) return null
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length
  const my = pts.reduce((s, p) => s + p.v, 0) / pts.length
  const num = xs.reduce((s, x, i) => s + (x - mx) * (pts[i].v - my), 0)
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
  if (!den) return null
  return { perWeek: Math.round((num / den) * 7 * 100) / 100, n: pts.length, spanDays: span }
}

// 이 추세가 이어지면 목표에 닿는 날짜(YYYY-MM-DD). 목표와 반대로 가고 있거나 너무 멀면 null, 이미 닿았으면 오늘.
export function projectDate(current, target, perWeek, now = new Date()) {
  const remaining = target - current
  if (remaining === 0) return todayStr(now)
  if (!perWeek || Math.sign(remaining) !== Math.sign(perWeek)) return null
  const days = Math.ceil((remaining / perWeek) * 7)
  return days > PROJECT_MAX_DAYS ? null : addDays(todayStr(now), days)
}

// 진행률: 시작 값 = 최근 180일 중 가장 오래된 기록. 시작 값과 목표 사이에서 지금이 어디쯤인지(0~100). 이미 닿았으면 reached.
function progressOf(records, key, target, cur, now) {
  const today = todayStr(now)
  const rs = series(records, key, today).filter(r => dayNum(today) - dayNum(r.date) <= BASELINE_DAYS)
  const start = rs.length ? rs[0].v : cur
  const reached = start >= target ? cur <= target : cur >= target
  if (start === target) return { start, pct: reached ? 100 : 0, reached }
  const pct = Math.min(100, Math.max(0, ((start - cur) / (start - target)) * 100))
  return { start: round1(start), pct: Math.round(pct), reached }
}

// 한 지표(체중 또는 체지방률)의 목표 요약. 목표가 없거나 현재 값을 알 수 없으면 null.
function metricSummary(records, key, target, fallbackCurrent, now) {
  if (target == null) return null
  let cur = currentValue(records, key, now)
  if (!cur && fallbackCurrent != null) cur = { value: Number(fallbackCurrent), date: null, count: 0, stale: true, daysAgo: null, fromProfile: true }
  if (!cur) return { target, cur: null }
  const trend = trendPerWeek(records, key, now)
  const projected = trend ? projectDate(cur.value, target, trend.perWeek, now) : null
  const p = progressOf(records, key, target, cur.value, now)
  return { target, cur, trend, projected, remaining: round1(target - cur.value), ...p }
}

// AI 루틴 만들기에서 목표를 섞는 비중에 쓰는 힌트: 방향(감량·증량·재구성·유지)과 필요한 크기(큼·보통·작음).
//  - 감량: 체지방률 또는 체중이 목표보다 높다. 증량: 목표 체중이 현재보다 높고 체지방률은 이미 목표 근처다.
//  - 재구성: 체지방률은 낮추고 체중은 올리려는 경우(체지방 감소 + 근육 증가)
// 숫자는 AI에 보내지 않고 이 방향·크기만 보낸다. 판단할 수 있는 현재 값이 없으면 null.
export function goalHint(fat, weight) {
  const fatGap = fat?.cur && fat.target != null ? fat.cur.value - fat.target : null // +면 줄일 것
  const wGap = weight?.cur && weight.target != null ? weight.cur.value - weight.target : null // +면 줄일 것, −면 늘릴 것
  if (fatGap == null && wGap == null) return null

  const cutLevel =
    fatGap != null && fatGap >= CUT_FAT_BIG ? '큼' : wGap != null && wGap >= CUT_WEIGHT_BIG ? '큼' : fatGap != null && fatGap >= CUT_FAT_MID ? '보통' : wGap != null && wGap >= CUT_WEIGHT_MID ? '보통' : null
  const gainLevel = wGap != null && wGap <= -GAIN_WEIGHT_BIG ? '큼' : wGap != null && wGap <= -GAIN_WEIGHT_MID ? '보통' : null

  const wantsLessFat = fatGap != null && fatGap >= CUT_FAT_MID
  if (wantsLessFat && gainLevel) return { direction: '재구성', level: cutLevel === '큼' || gainLevel === '큼' ? '큼' : '보통' }
  if (cutLevel) return { direction: '감량', level: cutLevel }
  if (gainLevel) return { direction: '증량', level: gainLevel }
  return { direction: '유지', level: '작음' }
}

// 힌트에 맞춰 AI 모달에서 미리 골라 둘 목표(사용자가 바꿀 수 있다). 감량·재구성은 근손실을 줄이려고 근비대를 함께 둔다.
export function suggestedGoals(hint) {
  if (!hint) return null
  if (hint.direction === '감량') return ['체지방 감량', '근비대']
  if (hint.direction === '재구성') return ['근비대', '체지방 감량']
  if (hint.direction === '증량') return ['근비대']
  return ['체력 유지']
}

const md = s => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`
const signed = n => `${n > 0 ? '+' : ''}${n}`

// 한 지표 요약(metricSummary 결과)을 화면에 보여줄 문장들로 바꾼다. 문장이 없으면 null.
// info: buildBodyGoal 결과의 { goalDate, daysLeft, goalPassed } / unit: 'kg' | '%'
export function describeMetric(m, unit, info = {}) {
  if (!m?.cur) return null
  const abs = Math.abs(m.remaining)
  const verb = m.remaining < 0 ? '줄이기' : '늘리기'
  const out = {
    remain: m.reached ? '목표에 도달했어요' : `${abs}${unit} ${verb}`,
    trend: m.trend ? `최근 기록 ${m.trend.n}개 기준 주 ${signed(m.trend.perWeek)}${unit}` : '추세는 최근 60일 안에 2주 이상에 걸친 기록이 3개 이상 있어야 계산해요',
    project: null,
    deadline: null,
    stale: m.cur.stale && m.cur.daysAgo != null ? `마지막 기록이 ${m.cur.daysAgo}일 전이라 지금과 다를 수 있어요` : m.cur.fromProfile ? '신체 기록이 없어 내 정보의 체중을 썼어요' : null,
  }
  if (!m.reached) {
    if (m.projected) out.project = `이 추세가 이어지면 ${md(m.projected)}쯤 도달해요`
    else if (m.trend) out.project = '지금 추세로는 목표에 닿기 어려워요(반대 방향이거나 변화가 너무 작아요)'
    if (info.goalPassed) out.deadline = '목표일이 지났어요'
    else if (info.goalDate && info.daysLeft != null) {
      const perWeek = Math.round((abs / (Math.max(info.daysLeft, 1) / 7)) * 10) / 10
      const pace = m.projected ? (m.projected <= info.goalDate ? ' · 지금 속도면 목표일 안에 닿아요' : ' · 지금 속도면 목표일보다 늦어요') : ''
      out.deadline = `목표일(${md(info.goalDate)})까지 ${info.daysLeft}일 · 주 ${perWeek}${unit} ${verb} 필요${pace}`
    }
  }
  return out
}

// 화면에 쓸 전체 요약. records: 신체 기록 / settings: { goalWeightKg, goalBodyFatPct, goalDate } / profileWeightKg: "내 정보" 체중(기록이 없을 때 대체)
export function buildBodyGoal(records, profileWeightKg, settings, now = new Date()) {
  const { goalWeightKg = null, goalBodyFatPct = null, goalDate = '' } = settings || {}
  const weight = metricSummary(records, 'weightKg', goalWeightKg, profileWeightKg, now)
  const fat = metricSummary(records, 'bodyFatPct', goalBodyFatPct, null, now)
  const today = todayStr(now)
  const daysLeft = goalDate && goalDate >= today ? dayNum(goalDate) - dayNum(today) : null
  const hint = goalHint(fat, weight)
  // 목표와 상관없이 지금 값(설정 화면에서 "현재 몸 상태"를 보여 줄 때 쓴다)
  const curWeight = currentValue(records, 'weightKg', now) || (profileWeightKg != null ? { value: Number(profileWeightKg), date: null, count: 0, stale: true, daysAgo: null, fromProfile: true } : null)
  const current = { weight: curWeight, fat: currentValue(records, 'bodyFatPct', now) }
  return { hasGoal: weight != null || fat != null, current, weight, fat, goalDate: goalDate || '', daysLeft, goalPassed: !!goalDate && goalDate < today, hint, suggestedGoals: suggestedGoals(hint) }
}
