import assert from 'node:assert/strict'
import { parseCsv, parseLogsCsv, normalizeDate, resolveExerciseName, IMPORT_MAX_ROWS } from '../src/lib/importData.js'
import { buildLogsCsv } from '../src/lib/exportData.js'

const TODAY = '2026-06-30'
const catalog = [
  { name: '벤치프레스', tags: ['벤치', 'bench'] },
  { name: '랫풀다운', tags: [] },
  { name: '스쿼트', tags: ['백스쿼트'] },
]
let n = 0
const opts = (extra = {}) => ({ exercises: catalog, existingLogs: [], today: TODAY, newId: () => `id${n++}`, ...extra })

// CSV 읽기: BOM·CRLF·따옴표·탭·세미콜론
assert.deepEqual(parseCsv('﻿a,b\r\n1,2\r\n').rows, [['a', 'b'], ['1', '2']])
assert.deepEqual(parseCsv('a,b\n"x,y","he said ""hi"""\n').rows[1], ['x,y', 'he said "hi"'])
assert.deepEqual(parseCsv('a,b\n"줄1\n줄2",3').rows[1], ['줄1\n줄2', '3'])
assert.equal(parseCsv('날짜\t운동\n2026-01-01\t벤치').delimiter, '\t')
assert.deepEqual(parseCsv('날짜\t운동\n2026-01-01\t벤치').rows[1], ['2026-01-01', '벤치'])
assert.equal(parseCsv('a;b\n1;2').delimiter, ';')
assert.deepEqual(parseCsv('a,b\n\n\n1,2\n').rows.length, 2) // 빈 줄 무시
assert.deepEqual(parseCsv('').rows, [])

// 날짜
assert.equal(normalizeDate('2026-03-05'), '2026-03-05')
assert.equal(normalizeDate('2026/3/5'), '2026-03-05')
assert.equal(normalizeDate('2026.3.5'), '2026-03-05')
assert.equal(normalizeDate('2026-02-30'), null)
assert.equal(normalizeDate('26-03-05'), null)
assert.equal(normalizeDate('abc'), null)
assert.equal(normalizeDate(''), null)
assert.equal(normalizeDate('2026-03-05 10:00'), '2026-03-05')

// 운동 이름 맞추기: 이름(공백·대소문자 무시)·태그
assert.equal(resolveExerciseName('벤치프레스', catalog), '벤치프레스')
assert.equal(resolveExerciseName('벤치 프레스', catalog), '벤치프레스')
assert.equal(resolveExerciseName('Bench', catalog), '벤치프레스')
assert.equal(resolveExerciseName('백스쿼트', catalog), '스쿼트')
assert.equal(resolveExerciseName('데드리프트', catalog), null)
assert.equal(resolveExerciseName('', catalog), null)

// 기본 가져오기: 같은 날짜·운동은 한 기록, 세트 번호 순서, 알 수 없는 운동은 그대로
{
  const csv = [
    '날짜,운동,세트,횟수,무게(kg)',
    '2026-03-05,벤치,2,8,60',
    '2026-03-05,벤치,1,10,55',
    '2026-03-05,벤치,3,6,62.5',
    '2026-03-05,랫풀다운,1,12,40',
    '2026-03-06,데드리프트,1,5,100',
  ].join('\n')
  const r = parseLogsCsv(csv, opts())
  assert.equal(r.headerError, null)
  assert.equal(r.stats.groups, 3)
  assert.equal(r.stats.sets, 5)
  assert.equal(r.stats.from, '2026-03-05')
  assert.equal(r.stats.to, '2026-03-06')
  assert.deepEqual(r.stats.unknown, ['데드리프트'])
  const bench = r.logs.find(l => l.exercise === '벤치프레스')
  assert.deepEqual(bench.performedSets.map(s => [s.reps, s.weight]), [[10, 55], [8, 60], [6, 62.5]]) // 세트 번호 순
  assert.equal(bench.targetSets, 3)
  assert.equal(bench.isCompleted, true)
  assert.equal(bench.skipped, false)
  assert.equal(bench.routineId, undefined)
  assert.equal(bench.kcal, null)
  assert.ok(bench.fatigue >= 1 && bench.fatigue <= 5)
  assert.ok(r.logs.every(l => typeof l.id === 'string'))
  assert.equal(new Set(r.logs.map(l => l.id)).size, 3)
}

// 세트 번호가 없으면 줄 순서, 무게·세트 열이 없어도 읽는다(무게 없음 경고)
{
  const r = parseLogsCsv('날짜,운동,횟수\n2026-03-05,푸쉬업,15\n2026-03-05,푸쉬업,12', opts())
  assert.equal(r.stats.weightMissing, true)
  assert.deepEqual(r.logs[0].performedSets.map(s => [s.reps, s.weight]), [[15, 0], [12, 0]])
}

// 영어 열 이름·단위가 붙은 값·소수점 쉼표
{
  const r = parseLogsCsv('Date,Exercise,Set,Reps,Weight (kg)\n2026-03-05,Bench,1,8회,"62,5kg"', opts())
  assert.equal(r.headerError, null)
  assert.deepEqual(r.logs[0].performedSets[0], { reps: 8, weight: 62.5, durationSeconds: null, restBeforeSeconds: null })
  assert.equal(r.logs[0].exercise, '벤치프레스')
}

// 오류 줄은 건너뛰고 이유를 알려 준다 / 나머지는 가져온다
{
  const csv = [
    '날짜,운동,횟수,무게',
    '2026-03-05,벤치,8,60',
    'abc,벤치,8,60',
    '2026-03-05,,8,60',
    '2026-03-05,벤치,0,60',
    '2026-03-05,벤치,8.5,60',
    '2026-03-05,벤치,8,-5',
    '2026-03-05,벤치,8,5000',
    '2026-07-15,벤치,8,60',
  ].join('\n')
  const r = parseLogsCsv(csv, opts())
  assert.equal(r.stats.sets, 1)
  assert.equal(r.stats.errorCount, 7)
  assert.deepEqual(r.stats.errors.map(e => e.line), [3, 4, 5, 6, 7, 8, 9])
  assert.match(r.stats.errors[6].message, /오늘 이후/)
}

// 열 이름 오류·빈 입력·데이터 없음·너무 많음
assert.match(parseLogsCsv('', opts()).headerError, /비어/)
assert.match(parseLogsCsv('날짜,운동\n2026-01-01,벤치', opts()).headerError, /횟수/)
assert.match(parseLogsCsv('날짜,운동,횟수', opts()).headerError, /기록이 없어요/)
assert.match(parseLogsCsv('날짜,운동,횟수\n' + Array(IMPORT_MAX_ROWS + 1).fill('2026-01-01,벤치,8').join('\n'), opts()).headerError, /까지만/)

// 중복: 이미 완료한 같은 날짜·운동 기록은 건너뛴다(미완료·다른 날짜는 아님) — 다시 가져와도 안전
{
  const existing = [
    { id: 'e1', date: '2026-03-05', exercise: '벤치프레스', isCompleted: true, performedSets: [{ reps: 8, weight: 60 }] },
    { id: 'e2', date: '2026-03-06', exercise: '벤치프레스', isCompleted: false, performedSets: [] },
  ]
  const csv = '날짜,운동,횟수,무게\n2026-03-05,벤치,8,60\n2026-03-06,벤치,8,60\n2026-03-07,벤치,8,60'
  const r = parseLogsCsv(csv, opts({ existingLogs: existing }))
  assert.equal(r.stats.duplicates, 1)
  assert.deepEqual(r.logs.map(l => l.date), ['2026-03-06', '2026-03-07'])
}

// 피로도 열이 있으면 그 값을, 범위 밖이면 추정값을 쓴다
{
  const r = parseLogsCsv('날짜,운동,횟수,무게,피로도\n2026-03-05,벤치,8,60,4\n2026-03-06,벤치,8,60,9', opts())
  assert.equal(r.logs[0].fatigue, 4)
  assert.ok(r.logs[1].fatigue >= 1 && r.logs[1].fatigue <= 5 && r.logs[1].fatigue !== 9)
}

// 이 앱의 내보내기 CSV를 그대로 다시 읽을 수 있다(왕복): 세트·횟수·무게·피로도 유지, 칼로리 열은 무시
{
  const original = [
    { id: 'a', date: '2026-02-01', exercise: '벤치프레스', routineId: 'r1', isCompleted: true, fatigue: 4, kcal: 120, performedSets: [{ reps: 8, weight: 60, durationSeconds: 30, restBeforeSeconds: 90 }, { reps: 7, weight: 60, durationSeconds: 28, restBeforeSeconds: 85 }] },
    { id: 'b', date: '2026-02-03', exercise: '랫풀다운, 와이드', isCompleted: true, fatigue: 3, kcal: 80, performedSets: [{ reps: 12, weight: 40 }] },
  ]
  const { csv } = buildLogsCsv(original, [{ id: 'r1', name: '가슴' }])
  const r = parseLogsCsv(csv, opts())
  assert.equal(r.headerError, null)
  assert.equal(r.stats.groups, 2)
  const a = r.logs.find(l => l.date === '2026-02-01')
  assert.deepEqual(a.performedSets, original[0].performedSets)
  assert.equal(a.fatigue, 4)
  const b = r.logs.find(l => l.date === '2026-02-03')
  assert.equal(b.exercise, '랫풀다운, 와이드') // 쉼표가 든 운동 이름도 따옴표로 왕복
  assert.deepEqual(b.performedSets[0], { reps: 12, weight: 40, durationSeconds: null, restBeforeSeconds: null })
}

// 구글 시트·엑셀에서 복사한 탭 구분 표
{
  const tsv = '날짜\t운동\t세트\t횟수\t무게\n2026-03-05\t스쿼트\t1\t5\t100\n2026-03-05\t스쿼트\t2\t5\t100'
  const r = parseLogsCsv(tsv, opts())
  assert.equal(r.stats.delimiter, '\t')
  assert.equal(r.logs[0].performedSets.length, 2)
}

console.log('OK: 기록 가져오기 전부 통과')
