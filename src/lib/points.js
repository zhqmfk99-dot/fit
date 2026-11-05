// 운동 포인트 — 웹앱·PWA 공용 로직(UI 아님). 지급은 서버(supabase/points.sql의 claim_points)가 하고, 여기서는 내역을 요약·표시만 한다.
// 지급 규칙(서버와 같아야 함): 운동한 날 +10, 주간 운동 목표를 채운 주 +30. 쓴 포인트는 음수 내역(pet_egg 새 알 · pet_feed 펫 먹이)으로 쌓인다.
import { weekStart } from './weeklyGoal.js'

export const POINT_WORKOUT_DAY = 10
export const POINT_WEEKLY_GOAL = 30

const md = ymd => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`

// 내역 한 줄의 표시 문구
export function eventLabel(e) {
  if (e.kind === 'workout_day') return `${md(e.ref)} 운동`
  if (e.kind === 'weekly_goal') return `${md(e.ref)} 주 운동 목표 달성`
  if (e.kind === 'pet_egg') return '새 알 받기'
  if (e.kind === 'pet_feed') return '펫 먹이'
  return e.ref
}

// events: [{ kind, ref, points, created_at }], today: 'YYYY-MM-DD'
// 반환: { balance(쓸 수 있는 포인트), earned(번 포인트), spent(쓴 포인트), weekEarned(이번 주에 번 포인트), recent(최근 내역 limit개, 최신순) }
export function summarizePoints(events, today, limit = 5) {
  const list = Array.isArray(events) ? events.filter(e => e && Number.isFinite(Number(e.points))) : []
  let earned = 0
  let spent = 0
  let weekEarned = 0
  const thisWeek = weekStart(today)
  for (const e of list) {
    const p = Number(e.points)
    if (p < 0) {
      spent += -p
      continue
    }
    earned += p
    // 운동한 날은 그날이 이번 주(월~일)인지, 주간 목표는 그 주 월요일이 이번 주 월요일인지로 센다
    if ((e.kind === 'workout_day' && weekStart(e.ref) === thisWeek) || (e.kind === 'weekly_goal' && e.ref === thisWeek)) weekEarned += p
  }
  const recent = [...list]
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')) || String(b.ref).localeCompare(String(a.ref)))
    .slice(0, limit)
    .map(e => ({ ...e, label: eventLabel(e) }))
  return { balance: earned - spent, earned, spent, weekEarned, recent }
}

// 완료한 세트가 있는 날짜들(서버의 _point_days와 같은 기준) — 이 목록이 바뀌면 포인트를 다시 받아 온다
export function workoutDaysKey(logs, today) {
  const days = new Set()
  for (const l of logs ?? []) {
    if (l.isCompleted && l.date <= today && l.performedSets?.some(s => (Number(s.reps) || 0) > 0)) days.add(l.date)
  }
  return [...days].sort().join(',')
}
