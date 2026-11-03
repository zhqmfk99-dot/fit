import assert from 'node:assert/strict'
import { buildDayDots, averageFatigue } from '../src/lib/dayDots.js'

const L = (id, exercise, extra = {}) => ({ id, exercise, date: '2026-11-09', isCompleted: false, ...extra })
const R1 = i => L(`r1-${i}`, `운동${i}`, { routineId: 'r1' })
const names = { r1: '등+어깨', r2: '팔' }
const nameOf = id => names[id] ?? ''

// 루틴 하나(7개)는 dot 1개 — 하나도 안 했으면 빈 동그라미(예정)
{
  const dots = buildDayDots([1, 2, 3, 4, 5, 6, 7].map(R1), nameOf)
  assert.equal(dots.length, 1)
  assert.equal(dots[0].kind, 'pending')
  assert.equal(dots[0].count, 7)
  assert.match(dots[0].title, /등\+어깨 · 예정 0\/7/)
}
// 두 루틴 = dot 2개(예: 이 화면의 11/9 — 7+7개가 14개 dot이던 칸)
{
  const logs = [...[1, 2, 3].map(R1), ...[1, 2].map(i => L(`r2-${i}`, `팔${i}`, { routineId: 'r2' }))]
  const dots = buildDayDots(logs, nameOf)
  assert.deepEqual(dots.map(d => [d.key, d.count]), [['r-r1', 3], ['r-r2', 2]])
}
// 완료한 운동이 있으면 완료한 것들의 평균 피로도 색(반올림), 일부만 완료해도 완료로 보이고 제목에 진행이 나온다
{
  const logs = [R1(1), R1(2), R1(3), R1(4)].map((l, i) => (i < 3 ? { ...l, isCompleted: true, fatigue: [2, 3, 5][i] } : l))
  const [dot] = buildDayDots(logs, nameOf)
  assert.equal(dot.kind, 'done')
  assert.equal(dot.fatigue, 3) // (2+3+5)/3 = 3.33 → 3
  assert.equal(dot.doneCount, 3)
  assert.match(dot.title, /등\+어깨 · 3\/4 완료 · 평균 피로 3/)
}
assert.equal(averageFatigue([{ fatigue: 4 }, { fatigue: 5 }]), 5) // 4.5 → 5
assert.equal(averageFatigue([{ fatigue: 1 }, { fatigue: 2 }]), 2) // 1.5 → 2
assert.equal(averageFatigue([{ fatigue: 0 }, { fatigue: null }, {}]), 3) // 피로도가 없으면 보통
assert.equal(averageFatigue([{ fatigue: 5 }, { fatigue: 0 }]), 5) // 0(직접 입력에서 비운 값)은 평균에서 뺀다
assert.equal(averageFatigue([]), 3)
// 전부 건너뜀이면 주황, 건너뜀과 예정이 섞이면 예정(아직 할 운동이 있음)
{
  assert.equal(buildDayDots([1, 2].map(i => ({ ...R1(i), skipped: true })), nameOf)[0].kind, 'skipped')
  assert.equal(buildDayDots([{ ...R1(1), skipped: true }, R1(2)], nameOf)[0].kind, 'pending')
  // 완료와 건너뜀이 섞이면 완료
  assert.equal(buildDayDots([{ ...R1(1), skipped: true }, { ...R1(2), isCompleted: true, fatigue: 2 }], nameOf)[0].kind, 'done')
}
// 수동 운동(루틴 없음)은 각각 dot 1개, 루틴 묶음과 같이 있어도 따로
{
  const logs = [R1(1), L('m1', '푸시업', { isCompleted: true, fatigue: 4 }), R1(2), L('m2', '플랭크'), L('m3', '크런치', { skipped: true })]
  const dots = buildDayDots(logs, nameOf)
  assert.deepEqual(dots.map(d => [d.key, d.kind]), [['r-r1', 'pending'], ['m1', 'done'], ['m2', 'pending'], ['m3', 'skipped']]) // 처음 나온 순서
  assert.equal(dots[1].fatigue, 4)
  assert.equal(dots[1].title, '푸시업 (피로 4)')
  assert.equal(dots[2].title, '플랭크 (예정)')
  assert.equal(dots[3].title, '크런치 (건너뜀)')
}
// 삭제된 루틴(이름을 못 찾음)은 "루틴"
assert.match(buildDayDots([R1(1)], () => '')[0].title, /^루틴 · /)
// 기록이 없으면 dot 없음
assert.deepEqual(buildDayDots([], nameOf), [])

console.log('OK: 날짜 dot 묶음 전부 통과')
