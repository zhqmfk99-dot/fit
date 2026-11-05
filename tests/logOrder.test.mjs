import assert from 'node:assert/strict'
import { orderLogsByRoutine } from '../src/lib/logOrder.js'

const routines = [
  { id: 'r1', name: '등+어깨', exercises: [{ exercise: '풀업' }, { exercise: '바벨 로우' }, { exercise: '랫풀다운' }, { exercise: '페이스 풀' }] },
  { id: 'r2', name: '팔', exercises: [{ exercise: '바벨 컬' }, { exercise: '푸시다운' }] },
]
const L = (id, exercise, routineId, date = '2026-11-09', extra = {}) => ({ id, exercise, routineId, date, isCompleted: false, ...extra })
const ids = list => list.map(l => l.id)

// 같은 시각에 저장돼 순서가 섞여 돌아온 루틴 묶음을 루틴의 운동 순서로 되돌린다
{
  const shuffled = [L('c', '랫풀다운', 'r1'), L('a', '풀업', 'r1'), L('d', '페이스 풀', 'r1'), L('b', '바벨 로우', 'r1')]
  assert.deepEqual(ids(orderLogsByRoutine(shuffled, routines)), ['a', 'b', 'c', 'd'])
}
// 묶음 밖 기록의 자리는 그대로, 묶음 안에서만 바뀐다(다른 루틴·다른 날짜·루틴 없는 기록이 사이에 끼어 있어도)
{
  const logs = [L('c', '랫풀다운', 'r1'), L('x', '푸시업', undefined), L('a', '풀업', 'r1'), L('k2', '푸시다운', 'r2'), L('b', '바벨 로우', 'r1'), L('k1', '바벨 컬', 'r2'), L('o', '풀업', 'r1', '2026-11-10')]
  const out = orderLogsByRoutine(logs, routines)
  assert.deepEqual(ids(out), ['a', 'x', 'b', 'k1', 'c', 'k2', 'o']) // r1(11/9)은 0·2·4번 자리에 a·b·c, r2는 3·5번 자리에 k1·k2
  assert.equal(out[1].id, 'x')
  assert.equal(out[6].id, 'o') // 다른 날짜의 같은 루틴은 따로 센다(한 개뿐이라 그대로)
}
// 날짜가 다르면 묶음이 따로다
{
  const logs = [L('b1', '바벨 로우', 'r1', '2026-11-09'), L('a1', '풀업', 'r1', '2026-11-09'), L('b2', '바벨 로우', 'r1', '2026-11-16'), L('a2', '풀업', 'r1', '2026-11-16')]
  assert.deepEqual(ids(orderLogsByRoutine(logs, routines)), ['a1', 'b1', 'a2', 'b2'])
}
// 루틴에 없는 이름(오늘만 바꾼 운동 등)은 묶음 맨 뒤에 원래 순서대로
{
  const logs = [L('s1', '스미스 로우', 'r1'), L('c', '랫풀다운', 'r1'), L('s2', '케이블 풀', 'r1'), L('a', '풀업', 'r1')]
  assert.deepEqual(ids(orderLogsByRoutine(logs, routines)), ['a', 'c', 's1', 's2'])
}
// 삭제된 루틴의 기록·루틴 없는 기록은 건드리지 않는다
{
  const logs = [L('z2', 'B', 'gone'), L('z1', 'A', 'gone'), L('m2', '크런치', undefined), L('m1', '플랭크', undefined)]
  assert.deepEqual(ids(orderLogsByRoutine(logs, routines)), ['z2', 'z1', 'm2', 'm1'])
}
// 이미 순서대로면 그대로, 원본 배열은 바뀌지 않는다, 빈 입력
{
  const ok = [L('a', '풀업', 'r1'), L('b', '바벨 로우', 'r1')]
  assert.deepEqual(ids(orderLogsByRoutine(ok, routines)), ['a', 'b'])
  const before = [L('b', '바벨 로우', 'r1'), L('a', '풀업', 'r1')]
  orderLogsByRoutine(before, routines)
  assert.deepEqual(ids(before), ['b', 'a'])
  assert.deepEqual(orderLogsByRoutine([], routines), [])
  assert.deepEqual(ids(orderLogsByRoutine(ok, undefined)), ['a', 'b'])
}
// 완료·건너뜀 여부와 상관없이 같은 묶음이면 루틴 순서(완료한 것도 순서대로 보인다)
{
  const logs = [L('b', '바벨 로우', 'r1', '2026-11-09', { isCompleted: true }), L('a', '풀업', 'r1', '2026-11-09', { skipped: true })]
  assert.deepEqual(ids(orderLogsByRoutine(logs, routines)), ['a', 'b'])
}
// 같은 이름이 루틴에 두 번 있으면 먼저 나온 자리를 쓴다
{
  const dup = [{ id: 'r3', exercises: [{ exercise: 'A' }, { exercise: 'B' }, { exercise: 'A' }] }]
  assert.deepEqual(ids(orderLogsByRoutine([L('b', 'B', 'r3'), L('a', 'A', 'r3')], dup)), ['a', 'b'])
}

console.log('OK: 루틴 운동 순서 정렬 전부 통과')
