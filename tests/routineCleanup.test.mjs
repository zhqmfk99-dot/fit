import assert from 'node:assert/strict'
import { upcomingPendingLogs, withoutUpcomingPending, pendingInGroup, withoutPendingInGroup } from '../src/lib/routineCleanup.js'

const TODAY = '2026-11-04'
const L = (id, routineId, date, extra = {}) => ({ id, routineId, date, exercise: `운동${id}`, isCompleted: false, ...extra })
const logs = [
  L('a1', 'r1', '2026-11-02', { isCompleted: true }),            // 과거 완료
  L('a2', 'r1', '2026-11-03'),                                    // 과거 미완료(놓친 예정)
  L('a3', 'r1', '2026-11-04'),                                    // 오늘 예정
  L('a4', 'r1', '2026-11-04', { isCompleted: true }),            // 오늘 완료
  L('a5', 'r1', '2026-11-09'),                                    // 앞으로 예정
  L('a6', 'r1', '2026-11-09', { skipped: true }),                // 앞으로 건너뜀
  L('a7', 'r1', '2026-11-16', { isCompleted: true }),            // 미래에 미리 완료 처리한 것
  L('b1', 'r2', '2026-11-09'),                                    // 다른 루틴
  L('s1', undefined, '2026-11-09'),                               // 루틴 없는 개별 기록
]
const ids = list => list.map(l => l.id)

// 루틴을 지울 때: 그 루틴의 오늘 이후 아직 안 한 기록(예정·건너뜀)만 지운다
assert.deepEqual(ids(upcomingPendingLogs(logs, 'r1', TODAY)), ['a3', 'a5', 'a6'])
assert.deepEqual(ids(withoutUpcomingPending(logs, 'r1', TODAY)), ['a1', 'a2', 'a4', 'a7', 'b1', 's1'])
// 완료한 기록(과거·오늘·미래)과 과거 미완료, 다른 루틴, 루틴 없는 기록은 그대로
assert.ok(['a1', 'a4', 'a7', 'a2', 'b1', 's1'].every(id => ids(withoutUpcomingPending(logs, 'r1', TODAY)).includes(id)))
// 지울 게 없으면 같은 내용
assert.deepEqual(ids(withoutUpcomingPending(logs, 'none', TODAY)), ids(logs))
assert.equal(upcomingPendingLogs(logs, 'none', TODAY).length, 0)
assert.equal(upcomingPendingLogs([], 'r1', TODAY).length, 0)
// 원본 배열은 바뀌지 않는다
assert.equal(logs.length, 9)

// 묶음 지우기: 같은 루틴·같은 날짜의 아직 안 한 기록만, 완료한 기록은 남는다
assert.deepEqual(ids(pendingInGroup(logs, 'r1', '2026-11-04')), ['a3'])
assert.deepEqual(ids(withoutPendingInGroup(logs, 'r1', '2026-11-04')), ['a1', 'a2', 'a4', 'a5', 'a6', 'a7', 'b1', 's1'])
assert.deepEqual(ids(pendingInGroup(logs, 'r1', '2026-11-09')), ['a5', 'a6']) // 예정·건너뜀 모두
assert.deepEqual(ids(withoutPendingInGroup(logs, 'r1', '2026-11-09')), ['a1', 'a2', 'a3', 'a4', 'a7', 'b1', 's1'])
// 날짜가 지난 묶음도 지울 수 있다(놓친 예정)
assert.deepEqual(ids(withoutPendingInGroup(logs, 'r1', '2026-11-03')), ids(logs).filter(id => id !== 'a2'))
// 완료한 기록만 있는 묶음은 지울 게 없다
assert.equal(pendingInGroup(logs, 'r1', '2026-11-02').length, 0)
assert.deepEqual(ids(withoutPendingInGroup(logs, 'r1', '2026-11-02')), ids(logs))

console.log('OK: 루틴 정리 전부 통과')
