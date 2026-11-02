// 주간 운동 목표("주 N일")와 연속 달성 — 웹앱·PWA 공용 로직(UI 아님), 규칙 기반이라 같은 기록이면 항상 같은 결과다.
//
// 주는 **월요일 시작의 달력 주**(월~일)다. 운동한 날 = 그날 완료한 기록(세트 1개 이상)이 있는 날(하루에 몇 번 해도 1일).
//   이번 주 목표를 채웠으면 이번 주도 연속에 포함하고, 아직이면 지난주까지의 연속을 보여 준다(이번 주가 진행 중이라 연속이 끊긴 게 아니다).
//   연속 = 목표를 채운 주가 끊김 없이 이어진 수. 운동 기록이 없던 주(첫 기록 이전)는 세지 않는다.
// 목표는 1~7일(설정의 weeklyGoalDays). 범위 밖·비어 있으면 null을 돌려준다.

export const GOAL_DAYS_MIN = 1
export const GOAL_DAYS_MAX = 7
const DAY_MS = 86400000
const WEEKS_SHOWN = 8

const dayNum = ymd => Math.floor(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / DAY_MS)
const fromNum = n => new Date(n * DAY_MS).toISOString().slice(0, 10)
// 월요일 날짜(YYYY-MM-DD). 1970-01-01은 목요일이라 (일수 + 3) % 7 이 월요일=0
const mondayNum = ymd => {
  const n = dayNum(ymd)
  return n - ((((n + 3) % 7) + 7) % 7)
}
export const weekStart = ymd => fromNum(mondayNum(ymd))

export const sanitizeGoalDays = v => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= GOAL_DAYS_MIN && n <= GOAL_DAYS_MAX && v !== null && v !== '' ? n : null
}

const isDone = l => l.isCompleted && l.performedSets?.some(s => (Number(s.reps) || 0) > 0)

// 주(월요일 날짜) → 그 주에 운동한 날 수, today 이후는 제외
function daysPerWeek(logs, today) {
  const perWeek = new Map()
  const seen = new Set()
  for (const l of logs) {
    if (!isDone(l) || l.date > today || seen.has(l.date)) continue
    seen.add(l.date)
    const w = mondayNum(l.date)
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1)
  }
  return perWeek
}

// 반환: null(목표 없음) 또는
//   { goal, week: { start, end, days, hit, needed, daysLeft, canReach }, streak, bestStreak, weeks: [{ start, days, hit, current }] }
//   needed: 목표까지 남은 운동일 수, daysLeft: 오늘부터 일요일까지 아직 운동할 수 있는 날 수(오늘 이미 운동했으면 오늘은 뺀다), canReach: needed ≤ daysLeft
export function weeklyGoalStatus(logs, goalDays, today) {
  const goal = sanitizeGoalDays(goalDays)
  if (goal == null) return null
  const perWeek = daysPerWeek(logs, today)
  const thisWeek = mondayNum(today)
  const days = perWeek.get(thisWeek) ?? 0
  const hit = days >= goal
  const trainedToday = logs.some(l => isDone(l) && l.date === today)
  const dayIndex = dayNum(today) - thisWeek // 월=0 … 일=6
  const daysLeft = 7 - dayIndex - (trainedToday ? 1 : 0)
  const needed = Math.max(0, goal - days)

  // 연속: 이번 주를 채웠으면 이번 주부터, 아니면 지난주부터 거슬러 올라가며 센다
  let streak = 0
  for (let w = hit ? thisWeek : thisWeek - 7; (perWeek.get(w) ?? 0) >= goal; w -= 7) streak++

  // 최고 연속: 첫 운동 주부터 이번 주까지(이번 주는 채웠을 때만)
  const keys = [...perWeek.keys()]
  let bestStreak = 0
  if (keys.length) {
    let run = 0
    for (let w = Math.min(...keys); w <= thisWeek; w += 7) {
      const ok = (perWeek.get(w) ?? 0) >= goal
      if (w === thisWeek && !ok) break // 진행 중인 주는 끊김으로 치지 않는다
      run = ok ? run + 1 : 0
      bestStreak = Math.max(bestStreak, run)
    }
  }

  const weeks = []
  for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
    const w = thisWeek - i * 7
    const d = perWeek.get(w) ?? 0
    weeks.push({ start: fromNum(w), days: d, hit: d >= goal, current: w === thisWeek })
  }

  return { goal, week: { start: fromNum(thisWeek), end: fromNum(thisWeek + 6), days, hit, needed, daysLeft, canReach: needed <= daysLeft }, streak, bestStreak, weeks }
}
