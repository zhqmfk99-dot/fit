import assert from 'node:assert/strict'
import { weeklyGoalStatus, weekStart, sanitizeGoalDays } from '../src/lib/weeklyGoal.js'

const L = (date, extra = {}) => ({ id: `${date}-${Math.random()}`, date, isCompleted: true, performedSets: [{ reps: 8, weight: 50 }], ...extra })

// 주 시작(월요일): 2026-06-24(수) → 06-22, 일요일 06-28 → 06-22, 월요일 06-29 → 06-29
assert.equal(weekStart('2026-06-24'), '2026-06-22')
assert.equal(weekStart('2026-06-28'), '2026-06-22')
assert.equal(weekStart('2026-06-29'), '2026-06-29')
assert.equal(weekStart('2026-01-01'), '2025-12-29') // 해를 넘기는 주

// 목표 값 정리
assert.equal(sanitizeGoalDays(3), 3)
assert.equal(sanitizeGoalDays('4'), 4)
assert.equal(sanitizeGoalDays(7), 7)
assert.equal(sanitizeGoalDays(0), null)
assert.equal(sanitizeGoalDays(8), null)
assert.equal(sanitizeGoalDays(null), null)
assert.equal(sanitizeGoalDays(''), null)
assert.equal(sanitizeGoalDays('abc'), null)
assert.equal(sanitizeGoalDays(undefined), null)
assert.equal(weeklyGoalStatus([], null, '2026-06-24'), null)

// 이번 주 진행: 수요일(06-24), 월·화 운동 → 2/3, 남은 날(수~일 = 5일), 1일 더 필요
{
  const s = weeklyGoalStatus([L('2026-06-22'), L('2026-06-23')], 3, '2026-06-24')
  assert.equal(s.week.start, '2026-06-22')
  assert.equal(s.week.end, '2026-06-28')
  assert.equal(s.week.days, 2)
  assert.equal(s.week.needed, 1)
  assert.equal(s.week.daysLeft, 5)
  assert.equal(s.week.hit, false)
  assert.equal(s.week.canReach, true)
  assert.equal(s.streak, 0)
}

// 하루에 여러 번·완료 안 한 기록·세트 없는 기록은 1일 또는 0일
{
  const logs = [L('2026-06-22'), L('2026-06-22'), L('2026-06-23', { isCompleted: false }), L('2026-06-23', { performedSets: [] }), L('2026-06-24', { performedSets: [{ reps: 0, weight: 50 }] })]
  assert.equal(weeklyGoalStatus(logs, 3, '2026-06-24').week.days, 1)
}

// 오늘 이미 운동했으면 오늘은 남은 날에서 뺀다 / 목표에 닿기 어려움
{
  const s = weeklyGoalStatus([L('2026-06-28')], 3, '2026-06-28') // 일요일, 오늘 운동 → 1/3, 남은 날 0
  assert.equal(s.week.daysLeft, 0)
  assert.equal(s.week.canReach, false)
  const s2 = weeklyGoalStatus([], 3, '2026-06-28') // 일요일 아직 0일 → 남은 날 1, 3일 필요
  assert.equal(s2.week.daysLeft, 1)
  assert.equal(s2.week.canReach, false)
  const s3 = weeklyGoalStatus([L('2026-06-22')], 2, '2026-06-28') // 일요일, 1/2, 오늘 운동하면 달성
  assert.equal(s3.week.canReach, true)
}

// 연속: 지난 3주 달성 + 이번 주 진행 중(미달) → 3주 연속(이번 주는 끊김 아님)
{
  const logs = []
  for (const w of ['2026-06-01', '2026-06-08', '2026-06-15']) for (const d of [0, 2, 4]) logs.push(L(new Date(Date.parse(w) + d * 86400000).toISOString().slice(0, 10)))
  const s = weeklyGoalStatus(logs, 3, '2026-06-23') // 화요일, 이번 주 0일
  assert.equal(s.streak, 3)
  assert.equal(s.week.hit, false)
  assert.equal(s.bestStreak, 3)
  // 이번 주 달성하면 4주 연속
  const more = [...logs, L('2026-06-22'), L('2026-06-23'), L('2026-06-24')]
  const s2 = weeklyGoalStatus(more, 3, '2026-06-24')
  assert.equal(s2.week.hit, true)
  assert.equal(s2.streak, 4)
  assert.equal(s2.bestStreak, 4)
  // 중간에 한 주 빠지면 끊김
  const gap = logs.filter(l => !l.date.startsWith('2026-06-08') && !['2026-06-09', '2026-06-10', '2026-06-12'].includes(l.date))
  assert.equal(weeklyGoalStatus(gap, 3, '2026-06-23').streak, 1) // 06-15 주만
}

// 과거에 길게 달성했다가 끊긴 뒤 최고 연속은 남는다
{
  const logs = []
  // 05-04, 05-11, 05-18, 05-25 4주 달성(주 2일), 06-01 주는 쉼, 06-08 주 달성
  for (const w of ['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25', '2026-06-08']) for (const d of [0, 3]) logs.push(L(new Date(Date.parse(w) + d * 86400000).toISOString().slice(0, 10)))
  const s = weeklyGoalStatus(logs, 2, '2026-06-11') // 목요일 — 이 주 월·목 2일 달성
  assert.equal(s.bestStreak, 4)
  assert.equal(s.streak, 1) // 이번 주만 달성(앞 주는 쉼)
  assert.equal(s.week.hit, true)
}

// 주 목록: 8주, 오래된 것부터, 마지막이 이번 주
{
  const s = weeklyGoalStatus([L('2026-06-22')], 1, '2026-06-24')
  assert.equal(s.weeks.length, 8)
  assert.equal(s.weeks[7].current, true)
  assert.equal(s.weeks[7].start, '2026-06-22')
  assert.equal(s.weeks[0].start, '2026-05-04')
  assert.equal(s.weeks[7].hit, true)
  assert.equal(s.weeks[6].hit, false)
}

// 기록이 없으면 연속 0, 미래 날짜 기록은 무시
{
  const s = weeklyGoalStatus([], 3, '2026-06-24')
  assert.equal(s.streak, 0)
  assert.equal(s.bestStreak, 0)
  assert.equal(weeklyGoalStatus([L('2026-06-26')], 3, '2026-06-24').week.days, 0)
}

console.log('OK: 주간 운동 목표 전부 통과')
