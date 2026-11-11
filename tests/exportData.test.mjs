import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLogsCsv, buildBodyCsv, sortLogsForExport, supersetGroupKeys } from '../src/lib/exportData.js'

const log = (id, date, exercise, sets, extra = {}) => ({ id, date, exercise, isCompleted: true, performedSets: sets, ...extra })
const set = (startedAt, reps = 8) => ({ reps, weight: 50, startedAt, endedAt: startedAt == null ? undefined : startedAt + 30000 })
const names = logs => logs.map(l => l.exercise)

test('같은 날은 실제로 시작한 시각 순 (id 순이 아니다)', () => {
  // id를 일부러 시간 순서와 반대로 둔다
  const logs = [log('z', '2026-11-05', '벤치프레스', [set(3000)]), log('m', '2026-11-05', '인클라인', [set(2000)]), log('a', '2026-11-05', '푸시다운', [set(1000)])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['푸시다운', '인클라인', '벤치프레스'])
})

test('날짜가 먼저, 그다음 날 안의 순서', () => {
  const logs = [log('1', '2026-11-06', 'B', [set(500)]), log('2', '2026-11-05', 'A2', [set(2000)]), log('3', '2026-11-05', 'A1', [set(1000)])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['A1', 'A2', 'B'])
})

test('수퍼세트는 각 운동의 첫 세트 시작 순', () => {
  const logs = [log('b', '2026-11-05', '케이블 푸시다운', [set(1100), set(1300)]), log('a', '2026-11-05', '덤벨 로우', [set(1000), set(1200)])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['덤벨 로우', '케이블 푸시다운'])
})

test('시각이 없는 기록은 앱이 가진 순서의 제자리에 두고, 시각 있는 기록끼리만 시각 순으로 자리를 채운다', () => {
  const none = [{ reps: 5, weight: 10 }]
  // 루틴 순서: A, B, C(시각 없음), D — 실제로는 D를 B보다 먼저 했다
  const logs = [log('1', '2026-11-05', 'A', [set(1000)]), log('2', '2026-11-05', 'B', [set(3000)]), log('3', '2026-11-05', 'C', none), log('4', '2026-11-05', 'D', [set(2000)])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['A', 'D', 'C', 'B']) // C는 3번째 자리 그대로, A·B·D가 시각 순으로 1·2·4번째 자리를 채움
})

test('일부만 수정해서 시각이 없어진 운동이 하루의 맨 뒤로 밀리지 않는다', () => {
  const none = [{ reps: 8, weight: 60 }]
  // 가운데 운동(벤치)만 수정 창에서 고쳐서 시각이 사라진 날 — 순서는 스쿼트 → 벤치 → 로우여야 한다
  const logs = [log('a', '2026-11-05', '스쿼트', [set(1000)]), log('b', '2026-11-05', '벤치', none), log('c', '2026-11-05', '로우', [set(5000)])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['스쿼트', '벤치', '로우'])
})

test('다른 날짜의 시각 없는 기록은 서로 영향이 없다', () => {
  const none = [{ reps: 5, weight: 10 }]
  const logs = [log('1', '2026-11-06', 'B2', [set(9000)]), log('2', '2026-11-05', 'A2', none), log('3', '2026-11-05', 'A1', [set(1000)]), log('4', '2026-11-06', 'B1', [set(8000)])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['A2', 'A1', 'B1', 'B2'])
})

test('시각이 전혀 없으면 배열 순서(루틴 순서) 그대로 — id 순으로 섞지 않는다', () => {
  const logs = [log('z', '2026-11-05', '첫째', [{ reps: 5 }]), log('a', '2026-11-05', '둘째', [{ reps: 5 }]), log('m', '2026-11-05', '셋째', [{ reps: 5 }])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['첫째', '둘째', '셋째'])
})

test('시작 시각이 같으면 배열 순서 (안정 정렬)', () => {
  const logs = [log('b', '2026-11-05', '먼저', [set(1000)]), log('a', '2026-11-05', '나중', [set(1000)])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['먼저', '나중'])
})

test('신체 기록 CSV: 맨 끝 열에 측정 기기(집 체중계 / 정밀 측정), 표시가 없는 예전 기록은 집 체중계', () => {
  const { csv, count } = buildBodyCsv([
    { id: '2', date: '2026-11-05', weightKg: 72, bodyFatPct: 18, source: 'precise' },
    { id: '1', date: '2026-11-01', weightKg: 75 },
  ])
  const lines = csv.replace('﻿', '').trim().split('\r\n')
  assert.equal(count, 2)
  assert.equal(lines[0].split(',').at(-1), '측정 기기')
  assert.equal(lines[1].split(',').at(-1), '집 체중계') // 날짜순: 11/1 먼저
  assert.equal(lines[2].split(',').at(-1), '정밀 측정')
})

test('원본 배열은 바꾸지 않는다', () => {
  const logs = [log('b', '2026-11-05', 'B', [set(2000)]), log('a', '2026-11-05', 'A', [set(1000)])]
  const before = names(logs)
  sortLogsForExport(logs)
  assert.deepEqual(names(logs), before)
})

test('CSV 줄 순서: 미완료는 빠지고 운동한 순서대로 세트가 나온다', () => {
  const logs = [
    log('z', '2026-11-05', '벤치프레스', [set(3000, 8), set(3100, 7)]),
    log('q', '2026-11-05', '미완료', [set(500)], { isCompleted: false }),
    log('a', '2026-11-05', '스쿼트', [set(1000, 5)]),
  ]
  const { csv, count } = buildLogsCsv(logs, [])
  const lines = csv.replace('﻿', '').trim().split('\r\n').slice(1)
  assert.equal(count, 3)
  assert.deepEqual(lines.map(l => l.split(',')[2]), ['스쿼트', '벤치프레스', '벤치프레스'])
})

// CSV 한 줄을 쉼표로 쪼갠다(테스트 데이터에는 따옴표가 없다)
const csvLines = csv => csv.replace('﻿', '').trim().split('\r\n').map(l => l.split(','))

test('수퍼세트 열: 이어진 운동은 같은 묶음 번호, 아닌 운동은 비운다 (세트마다 같은 번호가 반복)', () => {
  const logs = [
    log('a', '2026-11-05', '벤치프레스', [set(1000), set(1300)], { routineId: 'r1' }),
    log('b', '2026-11-05', '덤벨 로우', [set(1100), set(1400)], { routineId: 'r1', linkedToNext: true }),
    log('c', '2026-11-05', '케이블 푸시다운', [set(1200), set(1500)], { routineId: 'r1' }),
    log('d', '2026-11-05', '스쿼트', [set(5000)], { routineId: 'r1' }),
  ]
  // 루틴 순서: 벤치(단독) · 덤벨 로우→케이블 푸시다운(수퍼세트) · 스쿼트(단독)
  const rows = csvLines(buildLogsCsv(logs, [{ id: 'r1', name: '상체' }]).csv)
  assert.equal(rows[0][3], '수퍼세트')
  const byExercise = {}
  for (const r of rows.slice(1)) (byExercise[r[2]] ??= new Set()).add(r[3])
  assert.deepEqual([...byExercise['벤치프레스']], [''])
  assert.deepEqual([...byExercise['덤벨 로우']], ['수퍼세트 1'])
  assert.deepEqual([...byExercise['케이블 푸시다운']], ['수퍼세트 1'])
  assert.deepEqual([...byExercise['스쿼트']], [''])
})

test('수퍼세트: 세 운동 묶음, 같은 날 두 묶음은 번호가 줄 순서대로, 날짜가 바뀌면 1부터', () => {
  const logs = [
    log('1', '2026-11-05', 'A', [set(1000)], { routineId: 'r1', linkedToNext: true }),
    log('2', '2026-11-05', 'B', [set(1100)], { routineId: 'r1', linkedToNext: true }),
    log('3', '2026-11-05', 'C', [set(1200)], { routineId: 'r1' }), // A·B·C가 한 묶음
    log('4', '2026-11-05', 'D', [set(2000)], { routineId: 'r1', linkedToNext: true }),
    log('5', '2026-11-05', 'E', [set(2100)], { routineId: 'r1' }), // D·E 두 번째 묶음
    log('6', '2026-11-06', 'F', [set(100)], { routineId: 'r1', linkedToNext: true }),
    log('7', '2026-11-06', 'G', [set(200)], { routineId: 'r1' }),
  ]
  const rows = csvLines(buildLogsCsv(logs, []).csv).slice(1)
  assert.deepEqual(rows.map(r => `${r[2]}:${r[3]}`), ['A:수퍼세트 1', 'B:수퍼세트 1', 'C:수퍼세트 1', 'D:수퍼세트 2', 'E:수퍼세트 2', 'F:수퍼세트 1', 'G:수퍼세트 1'])
})

test('수퍼세트: 마지막 운동의 linkedToNext는 무시, 루틴 없는 기록·짝이 아직 안 끝난 운동도 처리', () => {
  const logs = [
    log('a', '2026-11-05', 'A', [set(1000)], { routineId: 'r1', linkedToNext: true }),
    log('b', '2026-11-05', 'B', [], { routineId: 'r1', isCompleted: false }), // A의 짝이지만 아직 안 함 → 내보내지 않지만 A는 수퍼세트 표시
    log('c', '2026-11-05', 'C', [set(3000)], { routineId: 'r1', linkedToNext: true }), // 마지막인데 linkedToNext → 묶음 아님
    log('m', '2026-11-05', '푸시업', [set(4000)], { linkedToNext: true }), // 루틴 없음
  ]
  const rows = csvLines(buildLogsCsv(logs, []).csv).slice(1)
  assert.deepEqual(rows.map(r => `${r[2]}:${r[3]}`), ['A:수퍼세트 1', 'C:', '푸시업:'])
})

test('수퍼세트 묶음은 다른 루틴·다른 날짜와 섞이지 않는다', () => {
  const logs = [
    log('a', '2026-11-05', 'A', [set(1000)], { routineId: 'r1', linkedToNext: true }),
    log('b', '2026-11-06', 'B', [set(2000)], { routineId: 'r1' }), // 날짜가 다르므로 A의 짝이 아니다
    log('c', '2026-11-05', 'C', [set(3000)], { routineId: 'r2' }), // 루틴이 다르므로 A의 짝이 아니다
  ]
  assert.equal(supersetGroupKeys(logs).size, 0)
})
