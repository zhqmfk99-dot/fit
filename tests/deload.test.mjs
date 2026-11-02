import assert from 'node:assert/strict'
import { deloadAdvice, isSnoozed, snoozeUntil, SNOOZE_DAYS } from '../src/lib/deload.js'

const TODAY = '2026-06-30'
const day = n => new Date(Date.UTC(2026, 5, 30) - n * 86400000).toISOString().slice(0, 10) // n일 전
let seq = 0
const L = (ago, exercise, weight, { reps = 8, target = 8, fatigue = 3, sets = 3 } = {}) => ({
  id: `l${seq++}`, date: day(ago), exercise, isCompleted: true, targetReps: target, fatigue,
  performedSets: Array.from({ length: sets }, () => ({ reps, weight })),
})

// 운동 기록이 거의 없으면 제안 없음
assert.equal(deloadAdvice([], TODAY).show, false)
assert.equal(deloadAdvice([L(1, '벤치', 60)], TODAY).show, false) // 최근 2주에 운동한 날 1일

// A. 4주 연속 무게를 올리면 consider(신호 1개)
{
  const logs = []
  // 주마다 두 번씩 운동하고 매주 무게를 올림: 3주 전 → 0주 전 4주
  for (let w = 3; w >= 0; w--) {
    logs.push(L(w * 7 + 5, '벤치', 60 + (3 - w) * 2.5 + 0))
    logs.push(L(w * 7 + 2, '벤치', 60 + (3 - w) * 2.5 + 1.25))
  }
  const r = deloadAdvice([L(30, '벤치', 55), ...logs], TODAY)
  assert.equal(r.show, true)
  assert.deepEqual(r.signals.map(s => s.kind), ['raise'])
  assert.equal(r.level, 'consider')
  assert.match(r.signals[0].text, /4주 연속/)
}

// 3주 연속만 오르면 제안 없음
{
  const logs = [L(40, '벤치', 50)]
  for (let w = 2; w >= 0; w--) {
    logs.push(L(w * 7 + 5, '벤치', 60 + (2 - w) * 2.5))
    logs.push(L(w * 7 + 2, '벤치', 60 + (2 - w) * 2.5 + 1.25))
  }
  assert.equal(deloadAdvice(logs, TODAY).show, false)
}

// 오른 주 사이에 운동을 쉰 주가 끼면 연속이 끊긴다
{
  const logs = [L(60, '벤치', 40)]
  const weeks = [0, 1, 3, 4] // 2주 전은 운동 안 함
  weeks.forEach((w, i) => {
    logs.push(L(w * 7 + 5, '벤치', 100 - i * 5))
    logs.push(L(w * 7 + 2, '벤치', 101 - i * 5))
  })
  assert.equal(deloadAdvice(logs, TODAY).show, false)
}

// 0주 전에 아직 운동 안 했으면 1주 전부터 센다
{
  const logs = [L(60, '벤치', 40)]
  for (let w = 4; w >= 1; w--) {
    logs.push(L(w * 7 + 5, '벤치', 60 + (4 - w) * 2.5))
    logs.push(L(w * 7 + 2, '벤치', 60 + (4 - w) * 2.5 + 1.25))
  }
  const r = deloadAdvice(logs, TODAY)
  assert.deepEqual(r.signals.map(s => s.kind), ['raise'])
}

// B. 두 주 연속 피로도 높음
{
  const logs = []
  for (const ago of [1, 3, 5, 8, 10, 12]) logs.push(L(ago, '스쿼트', 100, { fatigue: 5 }))
  const r = deloadAdvice(logs, TODAY)
  assert.deepEqual(r.signals.map(s => s.kind), ['fatigue'])
  // 한 주만 높으면 없음
  const one = [1, 3, 5].map(a => L(a, '스쿼트', 100, { fatigue: 5 })).concat([8, 10, 12].map(a => L(a, '스쿼트', 100, { fatigue: 2 })))
  assert.equal(deloadAdvice(one, TODAY).show, false)
  // 주당 운동이 3개 미만이면 평균을 믿지 않는다
  const few = [1, 3, 8, 10].map(a => L(a, '스쿼트', 100, { fatigue: 5 }))
  assert.equal(deloadAdvice(few, TODAY).show, false)
}

// C. 목표 횟수 미달이 잦음(6개 이상 중 40% 이상)
{
  const logs = [1, 2, 3, 8, 9, 10].map((a, i) => L(a, '로우', 60, { reps: i < 3 ? 6 : 8, target: 8 })) // 3/6 = 50%
  const r = deloadAdvice(logs, TODAY)
  assert.deepEqual(r.signals.map(s => s.kind), ['miss'])
  // 개수가 모자라면 판단 안 함
  assert.equal(deloadAdvice(logs.slice(0, 5), TODAY).show, false)
  // 40% 미만이면 없음
  const ok = [1, 2, 3, 8, 9, 10].map((a, i) => L(a, '로우', 60, { reps: i < 2 ? 6 : 8, target: 8 })) // 2/6
  assert.equal(deloadAdvice(ok, TODAY).show, false)
}

// 신호 2개 이상이면 recommend
{
  const logs = []
  for (let w = 3; w >= 0; w--) {
    logs.push(L(w * 7 + 5, '벤치', 60 + (3 - w) * 2.5, { fatigue: 5, reps: 6 }))
    logs.push(L(w * 7 + 2, '벤치', 60 + (3 - w) * 2.5 + 1.25, { fatigue: 5, reps: 6 }))
    logs.push(L(w * 7 + 3, '스쿼트', 80 + (3 - w) * 5, { fatigue: 5, reps: 6 }))
  }
  logs.push(L(35, '벤치', 55))
  const r = deloadAdvice(logs, TODAY)
  assert.equal(r.level, 'recommend')
  assert.ok(r.signals.length >= 2)
}

// 이미 가볍게 한 주는 제안하지 않는다(최근 주 볼륨이 앞 3주 평균의 60% 미만)
{
  const logs = []
  for (const ago of [8, 10, 12, 15, 17, 19, 22, 24, 26]) logs.push(L(ago, '스쿼트', 100, { fatigue: 5 })) // 1~3주 전은 무겁게(피로도 높음)
  logs.push(L(1, '스쿼트', 50, { fatigue: 5, sets: 2 }), L(3, '스쿼트', 50, { fatigue: 5, sets: 2 }), L(5, '스쿼트', 50, { fatigue: 5, sets: 2 }))
  assert.equal(deloadAdvice(logs, TODAY).show, false)
}

// 미래 날짜·미완료 기록은 무시
{
  const logs = [1, 3, 5, 8, 10, 12].map(a => L(a, '스쿼트', 100, { fatigue: 5 }))
  assert.equal(deloadAdvice(logs, TODAY).show, true)
  const future = { ...L(0, '스쿼트', 100), date: '2026-07-05' }
  assert.equal(deloadAdvice([...logs, future], TODAY).signals.length, deloadAdvice(logs, TODAY).signals.length)
  const undone = logs.map(l => ({ ...l, isCompleted: false }))
  assert.equal(deloadAdvice(undone, TODAY).show, false)
}

// 숨기기
assert.equal(snoozeUntil('2026-06-30'), '2026-07-07')
assert.equal(SNOOZE_DAYS, 7)
assert.equal(isSnoozed('2026-07-07', '2026-06-30'), true)
assert.equal(isSnoozed('2026-06-30', '2026-06-30'), false) // 당일이면 끝
assert.equal(isSnoozed('2026-06-01', '2026-06-30'), false)
assert.equal(isSnoozed(null, '2026-06-30'), false)
assert.equal(isSnoozed('abc', '2026-06-30'), false)

console.log('OK: 회복 주간 제안 전부 통과')
