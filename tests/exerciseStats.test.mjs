import assert from 'node:assert/strict'
import { e1rmOf, exerciseSessions, personalRecords, newRecordsOf, trendSeries, formatKg, E1RM_MAX_REPS } from '../src/lib/exerciseStats.js'

const L = (id, date, sets, extra = {}) => ({ id, date, exercise: '벤치프레스', isCompleted: true, performedSets: sets.map(([reps, weight]) => ({ reps, weight })), ...extra })

// 예상 1RM: Epley, 1회는 그 무게, 12회 초과·무게 0·횟수 0은 null
assert.equal(e1rmOf({ reps: 1, weight: 100 }), 100)
assert.ok(Math.abs(e1rmOf({ reps: 5, weight: 100 }) - 116.6667) < 1e-3)
assert.ok(Math.abs(e1rmOf({ reps: 10, weight: 60 }) - 80) < 1e-9)
assert.equal(e1rmOf({ reps: E1RM_MAX_REPS + 1, weight: 40 }), null)
assert.notEqual(e1rmOf({ reps: E1RM_MAX_REPS, weight: 40 }), null)
assert.equal(e1rmOf({ reps: 8, weight: 0 }), null)
assert.equal(e1rmOf({ reps: 0, weight: 50 }), null)
assert.equal(e1rmOf(null), null)

// 세션 모으기: 완료·같은 운동만, 날짜 오름차순, 횟수 0 세트는 제외
{
  const logs = [
    L('b', '2026-03-10', [[8, 60], [8, 60], [6, 65]]),
    L('a', '2026-03-01', [[10, 50]]),
    L('x', '2026-03-05', [[10, 50]], { isCompleted: false }),
    L('y', '2026-03-06', [[10, 50]], { exercise: '스쿼트' }),
    L('z', '2026-03-07', [[0, 50]]),
  ]
  const s = exerciseSessions(logs, '벤치프레스')
  assert.deepEqual(s.map(x => x.id), ['a', 'b'])
  assert.equal(s[1].topWeight, 65)
  assert.equal(s[1].topReps, 8)
  assert.equal(s[1].sets.length, 3)
  assert.equal(s[0].bodyweight, false)
  // 세션 최고 e1RM은 세트별 최고: 60×8=76, 65×6=78 → 78
  assert.ok(Math.abs(s[1].e1rm - 78) < 1e-9)
}

// 개인 기록: 최고 무게·최고 e1RM과 처음 낸 날짜
{
  const s = exerciseSessions([L('1', '2026-01-01', [[5, 80]]), L('2', '2026-01-08', [[5, 85]]), L('3', '2026-01-15', [[5, 85]]), L('4', '2026-01-22', [[3, 80]])], '벤치프레스')
  const pr = personalRecords(s)
  assert.deepEqual(pr.weight, { value: 85, date: '2026-01-08' }) // 같은 값은 처음 낸 날짜
  assert.equal(pr.e1rm.date, '2026-01-08')
  assert.equal(pr.reps, null)
}

// 맨몸 운동: 최대 횟수만
{
  const bw = exerciseSessions([L('1', '2026-01-01', [[10, 0], [8, 0]]), L('2', '2026-01-08', [[12, 0]])], '벤치프레스')
  const pr = personalRecords(bw)
  assert.equal(pr.weight, null)
  assert.equal(pr.e1rm, null)
  assert.deepEqual(pr.reps, { value: 12, date: '2026-01-08' })
  assert.equal(trendSeries(bw).kind, 'reps')
  assert.deepEqual(trendSeries(bw).points.map(p => p.value), [10, 12])
}

// 새 기록: 이전보다 높을 때만, 처음 하는 운동·같은 값은 아님
{
  const prev = [L('1', '2026-02-01', [[5, 80]]), L('2', '2026-02-08', [[5, 82.5]])]
  const better = L('3', '2026-02-15', [[5, 85]])
  const r = newRecordsOf([...prev, better], better)
  assert.deepEqual(r.map(x => x.kind), ['weight', 'e1rm'])
  assert.equal(r[0].value, 85)
  assert.equal(r[0].prev, 82.5)
  // 무게는 같고 횟수만 늘면 e1rm만
  const moreReps = L('4', '2026-02-15', [[7, 82.5]])
  assert.deepEqual(newRecordsOf([...prev, moreReps], moreReps).map(x => x.kind), ['e1rm'])
  // 같은 값·낮은 값은 갱신 아님
  const same = L('5', '2026-02-15', [[5, 82.5]])
  assert.deepEqual(newRecordsOf([...prev, same], same), [])
  const lower = L('6', '2026-02-15', [[5, 70]])
  assert.deepEqual(newRecordsOf([...prev, lower], lower), [])
  // 처음 하는 운동
  const first = L('7', '2026-02-15', [[5, 85]])
  assert.deepEqual(newRecordsOf([first], first), [])
  // 이후 날짜의 기록은 이전 기록으로 치지 않는다
  const later = L('8', '2026-03-01', [[5, 100]])
  assert.deepEqual(newRecordsOf([...prev, better, later], better).map(x => x.kind), ['weight', 'e1rm'])
  // 미완료 기록은 무시
  const todo = L('9', '2026-02-15', [[5, 85]], { isCompleted: false })
  assert.deepEqual(newRecordsOf([...prev, todo], todo), [])
}
// 맨몸 새 기록
{
  const prev = [L('1', '2026-02-01', [[10, 0]])]
  const cur = L('2', '2026-02-08', [[12, 0]])
  assert.deepEqual(newRecordsOf([...prev, cur], cur), [{ kind: 'reps', value: 12, prev: 10 }])
}

// 추이: 최근 n회만, e1RM 없는 세션은 최고 무게로
{
  const logs = Array.from({ length: 15 }, (_, i) => L(`i${i}`, `2026-01-${String(i + 1).padStart(2, '0')}`, [[5, 60 + i]]))
  const t = trendSeries(exerciseSessions(logs, '벤치프레스'))
  assert.equal(t.kind, 'e1rm')
  assert.equal(t.points.length, 12)
  assert.equal(t.points[0].date, '2026-01-04')
  const high = trendSeries(exerciseSessions([L('h', '2026-01-01', [[20, 30]])], '벤치프레스'))
  assert.equal(high.points[0].value, 30) // 20회라 e1RM 없음 → 최고 무게
  assert.deepEqual(trendSeries([]), { kind: 'e1rm', points: [] })
}

assert.equal(formatKg(82.26), '82.5kg')
assert.equal(formatKg(80), '80kg')

console.log('OK: 운동별 기록 통계 전부 통과')
