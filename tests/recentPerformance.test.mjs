import assert from 'node:assert/strict'
import { overworkedMuscles, strugglingExercises, OVERWORKED_TOP, STRUGGLING_TOP } from '../src/lib/recentPerformance.js'

const NOW = new Date()
const pad = n => String(n).padStart(2, '0')
const ago = n => {
  const d = new Date(NOW)
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const ex = (id, name, muscles) => ({ id, name, muscles })
const exercises = [
  ex('bench', '벤치프레스', ['chest', 'triceps']),
  ex('squat', '스쿼트', ['quadriceps', 'gluteal']),
  ex('row', '바벨 로우', ['upper-back', 'biceps']),
  ex('curl', '바벨 컬', ['biceps']),
]
const log = (daysAgo, exercise, fatigue, reps = [8, 8, 8], targetReps = 8, extra = {}) => ({
  id: `${daysAgo}${exercise}`, date: ago(daysAgo), exercise, isCompleted: true, fatigue, targetReps, performedSets: reps.map(r => ({ reps: r, weight: 60 })), ...extra,
})

// ── 피로가 높은 부위: 최근 3일 안에 했고 근육 피로도가 4 이상
{
  const logs = [log(1, '벤치프레스', 5), log(2, '스쿼트', 3), log(1, '바벨 로우', 4)]
  const names = overworkedMuscles(logs, exercises, NOW)
  assert.deepEqual([...names].sort(), ['가슴', '삼두', '이두', '등'].sort()) // 벤치(5): 가슴·삼두 / 로우(4): 등·이두. 스쿼트(3)의 부위는 제외
  assert.ok(!names.includes('대퇴사두'), '피로도 3인 부위는 제외')
  assert.ok(names.length <= OVERWORKED_TOP)
  // 높은 순: 벤치(5)가 로우(4)보다 앞
  assert.ok(names.indexOf('가슴') < names.indexOf('이두'))
}
// 오래 전의 높은 피로도는 "최근 3일 안에 했는가" 조건으로 거른다(가중 평균이라 오래 남아 있어도)
assert.deepEqual(overworkedMuscles([log(6, '벤치프레스', 5)], exercises, NOW), [])
assert.deepEqual(overworkedMuscles([log(3, '벤치프레스', 5)], exercises, NOW).includes('가슴'), true) // 경계: 3일 전 포함
// 미완료·운동 리스트에 없는 운동·기록 없음
assert.deepEqual(overworkedMuscles([log(1, '벤치프레스', 5, [8], 8, { isCompleted: false })], exercises, NOW), [])
assert.deepEqual(overworkedMuscles([log(1, '없는 운동', 5)], exercises, NOW), [])
assert.deepEqual(overworkedMuscles([], exercises, NOW), [])
// 같은 부위의 다른 운동 피로가 섞인다: 가슴 5와 3이 같이 있으면 반올림 평균(4)
{
  const e2 = [...exercises, ex('fly', '플라이', ['chest'])]
  assert.ok(overworkedMuscles([log(1, '벤치프레스', 5), log(1, '플라이', 3)], e2, NOW).includes('가슴'))
  assert.ok(!overworkedMuscles([log(1, '벤치프레스', 4), log(1, '플라이', 2)], e2, NOW).includes('가슴')) // 평균 3
}
// 부위가 많아도 4개까지
{
  const many = [ex('a', 'a', ['chest', 'triceps', 'biceps', 'quadriceps', 'gluteal', 'abs'])]
  assert.equal(overworkedMuscles([log(1, 'a', 5)], many, NOW).length, OVERWORKED_TOP)
}

// ── 목표를 못 채운 운동: 직전 두 번 연속 최소 세트 횟수가 목표 미만
{
  const logs = [
    log(10, '벤치프레스', 3, [8, 8, 6]), log(3, '벤치프레스', 3, [8, 7, 6]),   // 두 번 연속 미달
    log(10, '스쿼트', 3, [8, 8, 6]), log(3, '스쿼트', 3, [8, 8, 8]),           // 최근은 달성
    log(3, '바벨 로우', 3, [5, 5, 5]),                                          // 한 번뿐
  ]
  assert.deepEqual(strugglingExercises(logs, exercises, NOW), ['bench'])
}
// 직전 두 번만 본다: 그 전에 달성했어도, 최근 두 번이 미달이면 포함
assert.deepEqual(strugglingExercises([log(20, '벤치프레스', 3, [8, 8, 8]), log(10, '벤치프레스', 3, [6]), log(3, '벤치프레스', 3, [7])], exercises, NOW), ['bench'])
// 45일보다 오래된 기록·목표 횟수 없는 기록(직접 입력)·미완료는 세지 않는다
assert.deepEqual(strugglingExercises([log(60, '벤치프레스', 3, [6]), log(50, '벤치프레스', 3, [6])], exercises, NOW), [])
assert.deepEqual(strugglingExercises([log(10, '벤치프레스', 3, [6], 0), log(3, '벤치프레스', 3, [6], 0)], exercises, NOW), [])
assert.deepEqual(strugglingExercises([log(10, '벤치프레스', 3, [6], 8, { isCompleted: false }), log(3, '벤치프레스', 3, [6])], exercises, NOW), [])
// 운동 리스트에 없는 운동은 제외, 기록 없음
assert.deepEqual(strugglingExercises([log(10, '없는 운동', 3, [6]), log(3, '없는 운동', 3, [6])], exercises, NOW), [])
assert.deepEqual(strugglingExercises([], exercises, NOW), [])
// 가장 최근에 한 순, 8개까지
{
  const many = Array.from({ length: 12 }, (_, i) => ex(`x${i}`, `운동${i}`, ['chest']))
  const logs = many.flatMap((e, i) => [log(20, e.name, 3, [5]), log(i + 1, e.name, 3, [5])])
  const r = strugglingExercises(logs, many, NOW)
  assert.equal(r.length, STRUGGLING_TOP)
  assert.equal(r[0], 'x0') // 가장 최근(1일 전)
}

console.log('OK: 최근 수행 요약 전부 통과')
