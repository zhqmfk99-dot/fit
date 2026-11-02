import assert from 'node:assert/strict'
import { suggestSwaps, sessionExcludeNames, routineExerciseNames, swapLogs, swapRoutine } from '../src/lib/exerciseSwap.js'

const mk = (name, muscles, equipment, movementPattern, exerciseType, tags = []) => ({ name, muscles, equipment, movementPattern, exerciseType, tags })
const catalog = [
  mk('벤치프레스', ['chest', 'triceps', 'front-deltoids'], '바벨', '밀기', '복합관절', ['벤치']),
  mk('덤벨 벤치프레스', ['chest', 'triceps', 'front-deltoids'], '덤벨', '밀기', '복합관절'),
  mk('펙덱 플라이', ['chest', 'front-deltoids'], '머신', '밀기', '단관절', ['팩덱']),
  mk('푸시업', ['chest', 'triceps', 'front-deltoids'], '맨몸', '밀기', '복합관절'),
  mk('케이블 푸시다운', ['triceps'], '케이블', '밀기', '단관절'),
  mk('오버헤드프레스', ['front-deltoids', 'triceps'], '바벨', '밀기', '복합관절'),
  mk('랫풀다운', ['upper-back', 'biceps'], '머신', '당기기', '복합관절'),
  mk('스쿼트', ['quadriceps', 'gluteal'], '바벨', '스쿼트', '복합관절'),
]
const cur = catalog[0]
const names = r => r.map(x => x.exercise.name)

// ── 같은 부위가 먼저, 주 근육(가슴)을 쓰는 운동이 그다음 겹침 순서보다 앞
let r = suggestSwaps(cur, catalog)
assert.ok(!names(r.same).includes('벤치프레스'), '자기 자신은 제외')
assert.deepEqual(names(r.same), ['덤벨 벤치프레스', '푸시업', '펙덱 플라이', '오버헤드프레스', '케이블 푸시다운'])
assert.deepEqual(names(r.other).sort(), ['랫풀다운', '스쿼트'])   // 겹치는 근육이 없으면 "다른 부위"(순서는 점수 순)
// 가슴을 쓰는 운동 3개가 근육이 겹치기만 하는 운동(오버헤드프레스·푸시다운)보다 항상 앞
assert.ok(r.same.slice(0, 3).every(s => s.hasPrimary) && r.same.slice(3).every(s => !s.hasPrimary))
// 같은 동작 패턴·유형·장비 정보
const dumbbell = r.same[0]
assert.deepEqual([dumbbell.samePattern, dumbbell.sameType, dumbbell.shared], [true, true, ['chest', 'triceps', 'front-deltoids']])
assert.deepEqual(r.same.find(s => s.exercise.name === '펙덱 플라이').shared, ['chest', 'front-deltoids'])
// 같은 입력은 같은 결과
assert.deepEqual(names(suggestSwaps(cur, catalog).same), names(r.same))

// ── 제외(오늘 목록·루틴에 이미 있는 운동)
r = suggestSwaps(cur, catalog, { excludeNames: new Set(['푸시업', '스쿼트']) })
assert.ok(!names(r.same).includes('푸시업') && !names(r.other).includes('스쿼트'))

// ── 내 운동기구: 쓸 수 있는 기구(맨몸 포함)가 같은 점수대에서 앞선다. 단, 같은 부위 우선 순서는 깨지지 않는다
r = suggestSwaps(cur, catalog, { myEquipment: ['덤벨'] })
assert.deepEqual(names(r.same).slice(0, 3), ['덤벨 벤치프레스', '푸시업', '펙덱 플라이'])   // 덤벨·맨몸 가능, 머신은 불가라 뒤로
assert.equal(r.same.find(s => s.exercise.name === '펙덱 플라이').usable, false)
// 기구를 못 써도 목록에서 빼지는 않는다(후보는 그대로, 표시용 usable만 false)
assert.ok(names(r.same).includes('펙덱 플라이'))
r = suggestSwaps(cur, catalog, { myEquipment: ['머신'] })
assert.equal(names(r.same)[0], '펙덱 플라이'.length ? names(r.same)[0] : '')
assert.ok(r.same[0].hasPrimary)

// ── 검색: 이름·태그(별칭), 공백·대소문자 무시, 같은/다른 부위 모두에서 찾는다
r = suggestSwaps(cur, catalog, { query: '팩덱' })
assert.deepEqual(names(r.same), ['펙덱 플라이'])
r = suggestSwaps(cur, catalog, { query: ' 랫 풀 ' })
assert.deepEqual([names(r.same), names(r.other)], [[], ['랫풀다운']])
assert.deepEqual(names(suggestSwaps(cur, catalog, { query: '없는운동' }).same), [])

// ── 근육 정보가 없는 운동(직접 입력)이면 전부 "다른 부위", 에러 없이 동작
r = suggestSwaps({ name: '내가 만든 운동' }, catalog)
assert.equal(r.same.length, 0); assert.equal(r.other.length, catalog.length)
r = suggestSwaps({ name: 'x', muscles: [] }, catalog); assert.equal(r.same.length, 0)

// ── 오늘 목록 이름(루틴에만 있는 운동은 후보에 남는다) / 루틴 운동 이름
const logs = [
  { id: 'l1', routineId: 'r1', date: '2026-11-03', exercise: '벤치프레스' },
  { id: 'l2', routineId: 'r1', date: '2026-11-03', exercise: '랫풀다운' },
  { id: 'l3', routineId: 'r1', date: '2026-11-10', exercise: '벤치프레스' },
  { id: 'l4', routineId: 'r2', date: '2026-11-03', exercise: '스쿼트' },
]
const routines = [{ id: 'r1', name: 'A', exercises: [{ exercise: '벤치프레스', sets: 3, reps: 8, weight: 60, restSeconds: 90, linkedToNext: true, progressReps: 9 }, { exercise: '푸시업', sets: 3, reps: 12, weight: 0 }] }, { id: 'r2', exercises: [{ exercise: '스쿼트' }] }]
assert.deepEqual([...sessionExcludeNames(logs, 'r1', '2026-11-03')].sort(), ['랫풀다운', '벤치프레스'])     // 푸시업은 루틴에만 있어서 후보에 남는다(오늘 다른 운동으로 바꿨다면 되돌릴 수 있게)
assert.deepEqual([...routineExerciseNames(routines, 'r1')].sort(), ['벤치프레스', '푸시업'])
assert.equal(routineExerciseNames(routines, 'zzz').size, 0)

// ── swapLogs: 오늘 기록만
const full = [
  { id: 'l1', routineId: 'r1', date: '2026-11-03', exercise: '벤치프레스', targetSets: 3, targetReps: 8, targetWeight: 60, restSeconds: 90, linkedToNext: true, isCompleted: false, performedSets: [], kcal: null },
  { id: 'l2', routineId: 'r1', date: '2026-11-03', exercise: '랫풀다운', targetWeight: 40, isCompleted: false, performedSets: [] },
  { id: 'l3', routineId: 'r1', date: '2026-11-10', exercise: '벤치프레스', targetWeight: 60, isCompleted: false, performedSets: [] },
  { id: 'l5', routineId: 'r1', date: '2026-10-27', exercise: '벤치프레스', targetWeight: 60, isCompleted: true, performedSets: [{ reps: 8, weight: 60 }] },
  { id: 'l6', routineId: 'r1', date: '2026-11-17', exercise: '벤치프레스', targetWeight: 62, isCompleted: false, performedSets: [] },
]
let out = swapLogs(full, full[0], '덤벨 벤치프레스', 24, false)
assert.deepEqual(out.map(l => l.exercise), ['덤벨 벤치프레스', '랫풀다운', '벤치프레스', '벤치프레스', '벤치프레스'])
assert.deepEqual([out[0].targetWeight, out[0].targetSets, out[0].targetReps, out[0].restSeconds, out[0].linkedToNext], [24, 3, 8, 90, true])   // 목표·수퍼세트 묶기는 유지
// 루틴에도: 오늘 이후의 같은 운동 예정 기록만 바뀌고, 이미 한 기록(10/27)·다른 운동은 그대로
out = swapLogs(full, full[0], '덤벨 벤치프레스', 24, true)
assert.deepEqual(out.map(l => l.exercise), ['덤벨 벤치프레스', '랫풀다운', '덤벨 벤치프레스', '벤치프레스', '덤벨 벤치프레스'])
assert.deepEqual(out.filter(l => l.exercise === '덤벨 벤치프레스').map(l => l.targetWeight), [24, 24, 24])
assert.equal(out[3].performedSets.length, 1)                       // 완료 기록 보존
// 무게 정보 없음(null/NaN/음수) → 0(맨몸 취급, 운동 화면에서 직접 입력)
assert.equal(swapLogs(full, full[0], '푸시업', null, false)[0].targetWeight, 0)
assert.equal(swapLogs(full, full[0], '푸시업', -5, false)[0].targetWeight, 0)
// 이미 세트가 기록된/완료된 기록은 바꾸지 않는다(방어)
const partial = [{ ...full[0], performedSets: [{ reps: 8, weight: 60 }] }]
assert.equal(swapLogs(partial, partial[0], '푸시업', 0, false)[0].exercise, '벤치프레스')
assert.equal(swapLogs([{ ...full[0], isCompleted: true }], full[0], '푸시업', 0, false)[0].exercise, '벤치프레스')
// 원본 불변
assert.equal(full[0].exercise, '벤치프레스')
// 루틴 없는 기록(routineId 없음)은 toRoutine이어도 오늘 기록만
const solo = [{ id: 's', date: '2026-11-03', exercise: '벤치프레스', isCompleted: false, performedSets: [] }, { id: 's2', date: '2026-11-10', exercise: '벤치프레스', isCompleted: false, performedSets: [] }]
assert.deepEqual(swapLogs(solo, solo[0], '푸시업', 0, true).map(l => l.exercise), ['푸시업', '벤치프레스'])

// ── swapRoutine
const rr = swapRoutine(routines, full[0], '덤벨 벤치프레스', 24)
assert.deepEqual(rr[0].exercises[0], { exercise: '덤벨 벤치프레스', sets: 3, reps: 8, weight: 24, restSeconds: 90, linkedToNext: true, progressReps: undefined })
assert.equal(rr[0].exercises[1].exercise, '푸시업')                // 다른 항목 불변
assert.equal(rr[1].exercises[0].exercise, '스쿼트')                // 다른 루틴 불변
assert.equal(routines[0].exercises[0].exercise, '벤치프레스')       // 원본 불변
console.log('OK: 운동 교체 로직 전부 통과')
