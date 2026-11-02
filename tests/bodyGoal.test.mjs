import assert from 'node:assert/strict'
import { currentValue, trendPerWeek, projectDate, goalHint, suggestedGoals, buildBodyGoal, todayStr } from '../src/lib/bodyGoal.js'

const now = new Date(2026, 9, 27, 12) // 2026-10-27
const rec = (date, weightKg, bodyFatPct) => ({ date, weightKg, bodyFatPct })
assert.equal(todayStr(now), '2026-10-27')

// ── 현재 값: 최근 30일 안 마지막 3개 평균, 불규칙한 간격 OK, 없는 값은 건너뜀
const recs = [rec('2026-08-01', 80, 30), rec('2026-10-05', 76, null), rec('2026-10-12', 75, 27), rec('2026-10-20', 74, 26), rec('2026-10-25', 73, null), rec('2026-11-02', 50, 10)] // 마지막은 미래 → 무시
let c = currentValue(recs, 'weightKg', now)
assert.deepEqual([c.value, c.count, c.stale, c.date], [74, 3, false, '2026-10-25'])   // (75+74+73)/3
c = currentValue(recs, 'bodyFatPct', now)
assert.deepEqual([c.value, c.count], [26.5, 2])                                         // 10/12(27), 10/20(26): 30일 안, 8/1은 밖
// 30일 안에 기록이 없으면 마지막 값 + stale
c = currentValue([rec('2026-08-01', 80, 30), rec('2026-09-01', 79, 29)], 'weightKg', now)
assert.deepEqual([c.value, c.stale, c.daysAgo], [79, true, 56])
assert.equal(currentValue([], 'weightKg', now), null)
assert.equal(currentValue([rec('2026-10-01', null, null)], 'weightKg', now), null)

// ── 추세: 날짜 기준 회귀(불규칙 간격), 2주 이상·3개 이상 필요
const lin = [rec('2026-09-01', 80), rec('2026-09-15', 79), rec('2026-10-01', 78), rec('2026-10-25', 76.5)] // 대략 주당 -0.5kg대
let t = trendPerWeek(lin, 'weightKg', now)
assert.ok(t && t.perWeek < -0.4 && t.perWeek > -0.7 && t.n === 4, JSON.stringify(t))
// 간격이 달라도 같은 직선이면 같은 기울기: 일주일에 -1kg 직선(불규칙한 날짜)
const exact = [['2026-10-01', 80], ['2026-10-04', 80 - 3 / 7], ['2026-10-13', 80 - 12 / 7], ['2026-10-26', 80 - 25 / 7]].map(([d, w]) => rec(d, w))
assert.equal(trendPerWeek(exact, 'weightKg', now).perWeek, -1)
assert.equal(trendPerWeek([rec('2026-10-20', 80), rec('2026-10-25', 79), rec('2026-10-26', 78)], 'weightKg', now), null) // 2주 미만
assert.equal(trendPerWeek([rec('2026-09-01', 80), rec('2026-10-20', 79)], 'weightKg', now), null) // 2개
assert.equal(trendPerWeek([rec('2026-06-01', 90), rec('2026-06-20', 85), rec('2026-07-01', 80)], 'weightKg', now), null) // 60일 밖

// ── 도달 예상일
assert.equal(projectDate(75, 70, -1, now), '2026-12-01')      // 5주 = 35일 → 10/27 + 35일
assert.equal(projectDate(75, 70, +0.5, now), null)            // 반대로 가는 중
assert.equal(projectDate(75, 70, 0, now), null)
assert.equal(projectDate(75, 70, -0.01, now), null)           // 너무 멀다(2년 초과)
assert.equal(projectDate(70, 70, -1, now), '2026-10-27')      // 이미 도달
assert.equal(projectDate(60, 70, 1, now), '2027-01-05')       // 증량도 가능, 10주 = 70일

// ── AI 힌트(방향·크기)
const S = (cur, target) => ({ cur: { value: cur }, target })
assert.deepEqual(goalHint(S(28, 18), S(80, 72)), { direction: '감량', level: '큼' })      // 체지방 10%p
assert.deepEqual(goalHint(S(21, 18), null), { direction: '감량', level: '보통' })          // 체지방 3%p
assert.deepEqual(goalHint(null, S(80, 70)), { direction: '감량', level: '큼' })            // 체중 10kg
assert.deepEqual(goalHint(null, S(74, 70)), { direction: '감량', level: '보통' })          // 체중 4kg
assert.deepEqual(goalHint(S(19, 18), S(72, 71)), { direction: '유지', level: '작음' })     // 근처
assert.deepEqual(goalHint(null, S(60, 66)), { direction: '증량', level: '보통' })          // +6kg
assert.deepEqual(goalHint(S(12, 12), S(60, 70)), { direction: '증량', level: '큼' })       // +10kg, 체지방은 목표 도달
assert.deepEqual(goalHint(S(25, 18), S(70, 75)), { direction: '재구성', level: '큼' })     // 체지방↓ 체중↑
assert.deepEqual(goalHint(S(21, 18), S(70, 74)), { direction: '재구성', level: '보통' })
assert.equal(goalHint(null, null), null)
assert.equal(goalHint({ target: 18, cur: null }, { target: 70, cur: null }), null)         // 현재 값을 모르면 판단 불가
// 체지방 목표 근처 + 체중만 크게 높음 → 체중 기준 감량
assert.deepEqual(goalHint(S(18, 18), S(85, 75)), { direction: '감량', level: '큼' })
// 추천 목표 칩
assert.deepEqual(suggestedGoals({ direction: '감량', level: '큼' }), ['체지방 감량', '근비대'])
assert.deepEqual(suggestedGoals({ direction: '증량', level: '보통' }), ['근비대'])
assert.deepEqual(suggestedGoals({ direction: '재구성', level: '큼' }), ['근비대', '체지방 감량'])
assert.deepEqual(suggestedGoals({ direction: '유지', level: '작음' }), ['체력 유지'])
assert.equal(suggestedGoals(null), null)

// ── 전체 요약
const all = [rec('2026-07-01', 82, 30), rec('2026-09-01', 80, 28), rec('2026-10-01', 78, 26), rec('2026-10-15', 77, null), rec('2026-10-24', 76, 24.5)]
let g = buildBodyGoal(all, 70, { goalWeightKg: 70, goalBodyFatPct: 18, goalDate: '2027-01-31' }, now)
assert.equal(g.hasGoal, true)
assert.equal(g.weight.cur.value, 77)                       // (78+77+76)/3
assert.equal(g.weight.remaining, -7)
assert.equal(g.weight.start, 82)                           // 최근 180일 중 가장 오래된 기록
assert.equal(g.weight.pct, Math.round(((82 - 77) / (82 - 70)) * 100))
assert.equal(g.fat.cur.value, 25.3)                        // (28? 아님) 최근 30일: 26, 24.5 → 25.25 → 25.3
assert.equal(g.daysLeft, 96)
assert.equal(g.hint.direction, '감량'); assert.equal(g.hint.level, '큼')
assert.deepEqual(g.suggestedGoals, ['체지방 감량', '근비대'])
assert.ok(g.weight.trend && g.weight.trend.perWeek < 0 && g.weight.projected)
// 목표 없음, 기록 없음, 체중만 등록, 프로필 체중 대체, 지난 목표일
assert.equal(buildBodyGoal(all, 70, {}, now).hasGoal, false)
g = buildBodyGoal([], 70, { goalWeightKg: 65 }, now)
assert.deepEqual([g.weight.cur.value, g.weight.cur.fromProfile, g.hint.direction], [70, true, '감량'])
g = buildBodyGoal([], null, { goalWeightKg: 65 }, now)
assert.equal(g.weight.cur, null); assert.equal(g.hint, null); assert.equal(g.hasGoal, true)
g = buildBodyGoal(all, 70, { goalBodyFatPct: 20, goalDate: '2026-10-01' }, now)
assert.deepEqual([g.weight, g.goalPassed, g.daysLeft], [null, true, null])
// 이미 도달: 감량 목표보다 낮음 → reached, 진행률 100
g = buildBodyGoal([rec('2026-09-01', 80), rec('2026-10-20', 69)], null, { goalWeightKg: 70 }, now)
assert.deepEqual([g.weight.reached, g.weight.pct], [true, 100])
// 시작보다 멀어지면 진행률 0(음수 아님)
g = buildBodyGoal([rec('2026-09-01', 75), rec('2026-10-20', 79)], null, { goalWeightKg: 70 }, now)
assert.deepEqual([g.weight.reached, g.weight.pct], [false, 0])
// 증량 목표 진행률
g = buildBodyGoal([rec('2026-09-01', 60), rec('2026-10-20', 63)], null, { goalWeightKg: 66 }, now)
assert.equal(g.weight.pct, 50)
console.log('OK: 내 목표 계산 전부 통과')

// ── 문구
import { describeMetric } from '../src/lib/bodyGoal.js'
let d2 = buildBodyGoal(all, 70, { goalWeightKg: 70, goalBodyFatPct: 18, goalDate: '2027-01-31' }, now)
let w = describeMetric(d2.weight, 'kg', d2)
assert.equal(w.remain, '7kg 줄이기')
assert.match(w.trend, /^최근 기록 \d+개 기준 주 -/)
assert.match(w.project, /^이 추세가 이어지면 \d+\/\d+쯤 도달해요$/)
assert.match(w.deadline, /^목표일\(1\/31\)까지 96일 · 주 \d+(\.\d)?kg 줄이기 필요 · 지금 속도면 목표일( 안에 닿아요|보다 늦어요)$/)
assert.equal(w.stale, null)
// 이미 도달 / 목표일 지남 / 추세 없음 / 반대 방향 / 프로필 체중
d2 = buildBodyGoal([rec('2026-09-01', 80), rec('2026-10-20', 69)], null, { goalWeightKg: 70 }, now)
w = describeMetric(d2.weight, 'kg', d2); assert.deepEqual([w.remain, w.project, w.deadline], ['목표에 도달했어요', null, null])
d2 = buildBodyGoal([rec('2026-10-20', 75)], null, { goalWeightKg: 70, goalDate: '2026-10-01' }, now)
w = describeMetric(d2.weight, 'kg', d2); assert.deepEqual([w.deadline, w.project], ['목표일이 지났어요', null]); assert.match(w.trend, /3개 이상/)
d2 = buildBodyGoal([rec('2026-09-01', 75), rec('2026-09-20', 76), rec('2026-10-20', 78)], null, { goalWeightKg: 70 }, now)
w = describeMetric(d2.weight, 'kg', d2); assert.match(w.project, /목표에 닿기 어려워요/)
d2 = buildBodyGoal([], 72, { goalWeightKg: 70 }, now)
w = describeMetric(d2.weight, 'kg', d2); assert.equal(w.stale, '신체 기록이 없어 내 정보의 체중을 썼어요'); assert.equal(w.remain, '2kg 줄이기')
d2 = buildBodyGoal([rec('2026-08-01', 80, 30)], null, { goalBodyFatPct: 20 }, now)
w = describeMetric(d2.fat, '%', d2); assert.match(w.stale, /87일 전/); assert.equal(w.remain, '10%p'.replace('%p', '%') + ' 줄이기')
assert.equal(describeMetric(null, 'kg'), null)
assert.equal(describeMetric({ target: 70, cur: null }, 'kg'), null)
console.log('OK: 문구 통과')
