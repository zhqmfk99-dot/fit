import assert from 'node:assert/strict'
import { evaluateSession, qualityProblems, targetRepsOf, applyNextToPlan, FEEL_LABELS, FEEL_KEYS } from '../src/lib/progression.js'

const set = (reps, weight = 60, extra = {}) => ({ reps, weight, durationSeconds: reps * 3, restBeforeSeconds: 90, ...extra })
const base = (sets, extra = {}) => ({ targetSets: sets.length, targetReps: 8, targetWeight: 60, restSeconds: 90, fatigue: 3, performedSets: sets, ...extra })
const meta = { equipment: '바벨', movementPattern: '밀기' }
const ev = (log, opts = {}) => evaluateSession({ log, plan: null, prevLogs: [], meta, ...opts })

assert.deepEqual(FEEL_KEYS, ['easy', 'ok', 'hard'])
assert.equal(FEEL_LABELS.hard, '힘들었어요')

// 기존 규칙(체감 없음): 목표 달성 + 품질 좋음 → 무게 올리기
const good = [set(8), set(8), set(8)]
assert.equal(ev(base(good)).verdict, 'weight-up')
assert.equal(ev(base(good)).next.weight, 62.5)
// ok는 기존과 같다
assert.equal(ev(base(good, { feel: 'ok' })).verdict, 'weight-up')
// feel이 null이어도 같다
assert.equal(ev(base(good, { feel: null })).verdict, 'weight-up')

// hard: 목표를 다 채우고 품질이 좋아도 유지, 무게 그대로
{
  const r = ev(base(good, { feel: 'hard' }))
  assert.equal(r.verdict, 'hold')
  assert.equal(r.next.weight, 60)
  assert.match(r.reason, /힘들었어요/)
}
// easy: 정상 수행은 올리기(증량 폭은 그대로 — 더 크게 올리지 않는다)
{
  const r = ev(base(good, { feel: 'easy' }))
  assert.equal(r.verdict, 'weight-up')
  assert.equal(r.next.weight, 62.5)
  assert.match(r.reason, /쉬웠어요/)
}

// 목표를 못 채우면 easy여도 유지(미달 규칙이 먼저), 연속 미달 감량도 체감과 무관
{
  const miss = [set(8), set(8), set(6)]
  assert.equal(ev(base(miss, { feel: 'easy' })).verdict, 'hold')
  const prev = [1, 2].map(i => ({ performedSets: [set(8), set(8), set(6)], targetReps: 8, date: `2026-01-0${i}` }))
  assert.equal(ev(base(miss, { feel: 'easy' }), { prevLogs: prev }).verdict, 'deload')
}
// 계획한 세트를 다 못 하면 easy여도 유지
assert.equal(ev(base([set(8), set(8)], { targetSets: 3, feel: 'easy' })).verdict, 'hold')

// 휴식을 길게 쓴 경우: 기본은 유지, easy면 그 판단을 풀어 올리기, hard는 유지
{
  const slowRest = [set(8, 60, { startedAt: 0, endedAt: 30000 }), set(8, 60, { startedAt: 330000, endedAt: 360000 }), set(8, 60, { startedAt: 660000, endedAt: 690000 })]
  assert.equal(ev(base(slowRest)).verdict, 'hold')
  assert.equal(ev(base(slowRest, { feel: 'ok' })).verdict, 'hold')
  assert.equal(ev(base(slowRest, { feel: 'easy' })).verdict, 'weight-up')
  assert.equal(ev(base(slowRest, { feel: 'hard' })).verdict, 'hold')
}
// 속도가 느려진 경우도 같은 방식
{
  const slowTempo = [set(8, 60, { durationSeconds: 24 }), set(8, 60, { durationSeconds: 40 }), set(8, 60, { durationSeconds: 48 })]
  assert.equal(ev(base(slowTempo)).verdict, 'hold')
  assert.equal(ev(base(slowTempo, { feel: 'easy' })).verdict, 'weight-up')
}
// 세트가 무너진 경우(횟수 3회 이상 감소)는 easy여도 유지 — 쉬웠다는 말과 모순
{
  const collapse = [set(12), set(10), set(9)]
  assert.equal(ev(base(collapse, { targetReps: 8 })).verdict, 'hold')
  assert.equal(ev(base(collapse, { targetReps: 8, feel: 'easy' })).verdict, 'hold')
}
// qualityProblems의 ignoreSoft는 휴식·속도만 뺀다
{
  const sets = [set(12, 60, { durationSeconds: 24 }), set(9, 60, { durationSeconds: 60 })]
  assert.equal(qualityProblems(sets, 90).length >= 1, true)
  const soft = qualityProblems(sets, 90, { ignoreSoft: true })
  assert.deepEqual(soft.map(s => /줄었어요/.test(s)), [true])
}

// 맨몸: easy는 횟수 +1(기존과 같음), hard는 유지
{
  const bw = [set(10, 0), set(10, 0), set(10, 0)]
  const log = base(bw, { targetReps: 10, targetWeight: 0 })
  assert.equal(ev(log).verdict, 'reps-up')
  assert.equal(ev({ ...log, feel: 'easy' }).next.reps, 11)
  assert.equal(ev({ ...log, feel: 'hard' }).verdict, 'hold')
}

// 맨몸 목표를 못 채우면 바로 횟수 낮추기: 다음 목표 = 가장 적게 한 세트의 횟수 (무게 운동의 3번 연속 규칙과 다름)
{
  const miss = [set(12, 0), set(10, 0), set(8, 0)]
  const log = base(miss, { targetReps: 12, targetWeight: 0 })
  const r = ev(log)
  assert.equal(r.verdict, 'reps-down')
  assert.equal(r.label, '횟수 낮추기')
  assert.deepEqual(r.next, { sets: 3, reps: 8, weight: 0 })
  assert.match(r.reason, /가장 적게 한 세트 8회.*8회로 맞춰요/)
  // 체감·피로도와 무관하게(미달 규칙이 먼저) 낮춘다
  assert.equal(ev({ ...log, feel: 'easy' }).verdict, 'reps-down')
  assert.equal(ev({ ...log, feel: 'hard' }).verdict, 'reps-down')
  assert.equal(ev({ ...log, fatigue: 5 }).verdict, 'reps-down')
  // 한 세트가 0회여도 목표는 1회 아래로 내리지 않는다
  assert.equal(ev(base([set(5, 0), set(0, 0)], { targetReps: 8, targetWeight: 0 })).next.reps, 1)
  // 계획한 세트를 다 못 했으면 낮추지 않고 유지(기존 규칙이 먼저)
  assert.equal(ev(base([set(8, 0), set(6, 0)], { targetSets: 3, targetReps: 12, targetWeight: 0 })).verdict, 'hold')
  // 무게 운동은 그대로 유지(연속 3번 미달 전까지)
  assert.equal(ev(base([set(8), set(8), set(6)])).verdict, 'hold')
  // 낮춘 목표를 채우면 다시 +1씩 올라간다
  const again = ev(base([set(8, 0), set(8, 0), set(8, 0)], { targetReps: 8, targetWeight: 0 }))
  assert.equal(again.verdict, 'reps-up'); assert.equal(again.next.reps, 9)
}

// 목표 횟수(targetRepsOf)·루틴 반영(applyNextToPlan): 맨몸은 루틴의 반복보다 낮은 목표도 쓰고, 무게 운동은 루틴의 반복 그대로
{
  const plan = { exercise: '푸시업', sets: 3, reps: 12, weight: 0 }
  assert.equal(targetRepsOf(plan), 12)
  const lowered = applyNextToPlan(plan, { sets: 3, reps: 8, weight: 0 })
  assert.equal(lowered.reps, 12)           // 사용자가 정한 반복은 건드리지 않고
  assert.equal(lowered.progressReps, 8)    // 앱이 맞춘 값만 따로 둔다
  assert.equal(targetRepsOf(lowered), 8)   // 이전에는 max(12, 8) = 12라 낮출 수 없었다
  assert.equal(targetRepsOf(applyNextToPlan(lowered, { sets: 3, reps: 9, weight: 0 })), 9)
  assert.equal(targetRepsOf({ exercise: '벤치프레스', reps: 8, weight: 60, progressReps: 5 }), 8) // 무게 운동은 progressReps를 쓰지 않는다
  assert.equal(targetRepsOf({ reps: 10, weight: 0, progressReps: undefined }), 10)
}

// 피로도 5는 체감과 무관하게 유지(easy여도)
assert.equal(ev(base(good, { fatigue: 5, feel: 'easy' })).verdict, 'hold')

console.log('OK: 체감 난이도 평가 전부 통과')
