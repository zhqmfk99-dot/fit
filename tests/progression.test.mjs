import assert from 'node:assert/strict'
import { evaluateSession, qualityProblems, FEEL_LABELS, FEEL_KEYS } from '../src/lib/progression.js'

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

// 피로도 5는 체감과 무관하게 유지(easy여도)
assert.equal(ev(base(good, { fatigue: 5, feel: 'easy' })).verdict, 'hold')

console.log('OK: 체감 난이도 평가 전부 통과')
