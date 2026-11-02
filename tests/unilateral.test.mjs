import assert from 'node:assert/strict'
import { totalVolume, unilateralNames, sideFactor } from '../src/lib/workoutMetrics.js'
import { estimateLogKcal, logSeconds, applyKcal, kcalByDate, estimateDayKcal } from '../src/lib/calories.js'
import { buildWeeklyReport } from '../src/lib/weeklyReport.js'

const catalog = [
  { name: '덤벨 로우', muscles: ['upper-back'], unilateral: true },
  { name: '벤치프레스', muscles: ['chest'], unilateral: false },
  { name: '런지', muscles: ['quadriceps'] }, // 표시 없음(undefined)
]
const uni = unilateralNames(catalog)
assert.deepEqual([...uni], ['덤벨 로우'])
assert.equal(unilateralNames(null).size, 0)

const mk = (exercise, over = {}) => ({
  id: exercise, date: '2026-10-26', exercise, isCompleted: true, targetWeight: 20,
  performedSets: [10, 10, 10].map((reps, i) => ({ reps, weight: 20, durationSeconds: 40, restBeforeSeconds: i ? 90 : null })),
  ...over,
})
const row = mk('덤벨 로우'), bench = mk('벤치프레스')

// ── 볼륨
assert.equal(totalVolume(row), 600)           // uni 없으면 그대로(기존 동작)
assert.equal(totalVolume(row, uni), 1200)     // 한쪽씩 → ×2
assert.equal(totalVolume(bench, uni), 600)    // 일반 운동은 그대로
assert.equal(totalVolume({ ...row, performedSets: [] }, uni), 0)
assert.equal(sideFactor(row, uni), 2); assert.equal(sideFactor(bench, uni), 1); assert.equal(sideFactor(row, undefined), 1)

// ── 칼로리: 같은 기록이라도 한쪽씩 운동은 볼륨(밀도)이 2배라 강도 점수가 높아져 kcal이 같거나 커진다. 시간 기반이라 일반 운동 값은 그대로.
const logs = [row, bench]
const kPlain = estimateLogKcal(row, logs, 70, 1)
const kUni = estimateLogKcal(row, logs, 70, 1, uni)
assert.ok(kUni > kPlain, `${kUni} > ${kPlain}`)
assert.equal(estimateLogKcal(bench, logs, 70, 1, uni), estimateLogKcal(bench, logs, 70, 1)) // 일반 운동은 불변
assert.equal(estimateLogKcal(row, logs, 70), kPlain)                                         // uni 인자 생략 = 기존 값

// ── 시간을 재지 않은 세트(직접 입력): 횟수 × 4초 × 양쪽(2)
const noDur = mk('덤벨 로우', { performedSets: [{ reps: 10, weight: 20 }] })
const base = logSeconds({ ...noDur, exercise: '벤치프레스' }, [noDur])
const dbl = logSeconds(noDur, [noDur], uni)
assert.equal(dbl - base, 10 * 4) // 한쪽 기준 10회 → 양쪽이라 40초 더
// 시간을 잰 세트는 실측이 우선(양쪽 합친 시간이므로 배수 적용 안 함)
assert.equal(logSeconds(row, logs, uni), logSeconds(row, logs))

// ── applyKcal / estimateDayKcal / kcalByDate 가 uni를 받는다(저장값 없는 기록)
const nextLogs = applyKcal([{ ...row, kcal: null }], [], { bodyRecords: [], profileWeightKg: 70, calibration: 1, uni })
assert.equal(nextLogs[0].kcal, Math.round(kUni * 10) / 10)
const day = estimateDayKcal('2026-10-26', [{ ...row, kcal: null }], 70, 1, uni)
const dayPlain = estimateDayKcal('2026-10-26', [{ ...row, kcal: null }], 70, 1)
assert.ok(day >= dayPlain)
assert.equal(kcalByDate([{ ...row, kcal: null }], [], 70, 1, uni)[0].kcal, day)
// 저장된 kcal이 있으면 그대로(토글해도 과거 값은 안 바뀜 — "과거 기록 다시 계산"으로만 갱신)
assert.equal(estimateDayKcal('2026-10-26', [{ ...row, kcal: 50 }], 70, 1, uni), estimateDayKcal('2026-10-26', [{ ...row, kcal: 50 }], 70, 1))

// ── 주간 리포트: 볼륨에만 ×2, 세트 수·부위 세트는 그대로
const now = new Date(2026, 9, 27, 12)
const wr = buildWeeklyReport([row, bench], catalog, now)
const wrPlain = buildWeeklyReport([row, bench], catalog.map(e => ({ ...e, unilateral: false })), now)
assert.equal(wr.cur.volume, 600 * 2 + 600)
assert.equal(wrPlain.cur.volume, 600 + 600)
assert.equal(wr.cur.sets, wrPlain.cur.sets)
assert.deepEqual(wr.groups, wrPlain.groups)
console.log('OK: 한쪽씩 계산 전부 통과')
