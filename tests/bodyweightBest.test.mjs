import assert from 'node:assert/strict'
import { buildBodyweightBest, BODYWEIGHT_BEST_MAX } from '../src/lib/bodyweightBest.js'

const NOW = new Date('2026-07-01T12:00:00')
const ex = (id, name) => ({ id, name, muscles: ['upper-back'] })
const exercises = [ex('p', '풀업'), ex('d', '딥스'), ex('b', '벤치프레스'), ex('s', '스쿼트'), ex('n', '안 한 운동')]
const log = (date, exercise, sets, done = true) => ({ id: `${date}${exercise}`, date, exercise, isCompleted: done, performedSets: sets.map(([reps, weight]) => ({ reps, weight })) })

const logs = [
  log('2026-06-20', '풀업', [[3, 0], [2, 0]]),
  log('2026-06-25', '풀업', [[4, 0], [3, 0], [3, 0]]), // 최고 4회
  log('2026-06-10', '딥스', [[8, 0]]),
  log('2026-06-12', '딥스', [[6, 10]]),               // 무게 있는 세션은 맨몸 최고 기록에 안 들어간다(딥스 8회는 무게 없는 세션 값)
  log('2026-06-15', '벤치프레스', [[8, 60]]),          // 무게 운동은 제외
  log('2026-06-18', '스쿼트', [[10, 0], [8, 40]]),     // 한 세트라도 무게가 있으면 맨몸 세션이 아니다
  log('2026-06-28', '안 한 운동', [[12, 0]], false),    // 미완료 제외
]

let r = buildBodyweightBest(logs, exercises, NOW)
assert.deepEqual(r, [{ id: 'd', reps: 8 }, { id: 'p', reps: 4 }]) // 횟수 많은 순, 맨몸 세션만

// 무게를 단 세션만 있으면 맨몸 기록이 아니다
assert.deepEqual(buildBodyweightBest([log('2026-06-12', '딥스', [[6, 10]])], exercises, NOW), [])

// 180일보다 오래된 기록은 쓰지 않는다
r = buildBodyweightBest([log('2025-12-01', '풀업', [[10, 0]]), log('2026-06-25', '풀업', [[4, 0]])], exercises, NOW)
assert.deepEqual(r, [{ id: 'p', reps: 4 }]) // 2025-12-01은 212일 전
assert.deepEqual(buildBodyweightBest([log('2025-12-01', '풀업', [[10, 0]])], exercises, NOW), [])
// 경계: 180일 전 날짜는 포함
assert.deepEqual(buildBodyweightBest([log('2026-01-02', '풀업', [[5, 0]])], exercises, NOW), [{ id: 'p', reps: 5 }])

// 운동 리스트에 없는 이름은 무시, 기록이 없으면 빈 배열
assert.deepEqual(buildBodyweightBest([log('2026-06-25', '없는 운동', [[5, 0]])], exercises, NOW), [])
assert.deepEqual(buildBodyweightBest([], exercises, NOW), [])

// 20개까지만, 횟수 많은 순
const many = Array.from({ length: 25 }, (_, i) => ex(`x${i}`, `운동${i}`))
r = buildBodyweightBest(many.map((e, i) => log('2026-06-25', e.name, [[i + 1, 0]])), many, NOW)
assert.equal(r.length, BODYWEIGHT_BEST_MAX)
assert.equal(r[0].reps, 25)
assert.equal(r[19].reps, 6)

console.log('OK: 맨몸 운동 최고 기록 계산 통과')
