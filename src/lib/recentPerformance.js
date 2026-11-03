// 최근 수행 요약 — AI 루틴 만들기가 "지금 몸 상태·수준"을 반영하게 알려 주는 값. 웹앱·PWA 공용 로직(UI 아님), 서버 연결이 없는 순수 함수라 Node 테스트에서 바로 불러올 수 있다.
//
//  - overworkedMuscles: 회복이 덜 된 부위. 최근 3일 안에 한 부위 중, 근육 피로도 평균(lib/muscleMap.js의 computeMuscleFatigue)이 4 이상인 부위 이름(높은 순, 최대 4개).
//                       computeMuscleFatigue는 기록들의 가중 평균이라 오래 전 한 번의 값이 계속 남으므로, "최근 3일 안에 했는가"를 따로 본다.
//  - strugglingExercises: 같은 운동을 직전 두 번 연속 목표 횟수를 못 채운 운동(최근 45일, 최대 8개의 id).
//                         한 번의 못 채움은 컨디션일 수 있어서 두 번 연속일 때만 본다.
// 운동 이름·부위만 쓰고 무게·횟수·날짜 같은 숫자는 밖으로 나가지 않는다(AI에는 부위 이름과 운동 id만 간다).
// ※ 피로도 4 이상·3일·두 번 연속·45일은 흔히 쓰는 값으로 정한 가정이다.
import { computeMuscleFatigue, MUSCLE_LABELS } from './muscleMap.js'

export const OVERWORKED_MIN_LEVEL = 4
export const OVERWORKED_RECENT_DAYS = 3
export const OVERWORKED_TOP = 4 // 서버의 MAX_OVERWORKED와 같아야 한다
export const STRUGGLING_DAYS = 45
export const STRUGGLING_SESSIONS = 2
export const STRUGGLING_TOP = 8 // 서버의 MAX_STRUGGLING과 같아야 한다

const pad = n => String(n).padStart(2, '0')
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgoStr = (n, now) => {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  return dateStr(d)
}

const isDone = l => l.isCompleted && l.performedSets?.length

export function overworkedMuscles(logs, exercises, now = new Date()) {
  const byName = new Map(exercises.map(e => [e.name, e]))
  const since = daysAgoStr(OVERWORKED_RECENT_DAYS, now)
  const today = dateStr(now)
  const recentlyTrained = new Set(
    logs.filter(l => isDone(l) && l.date >= since && l.date <= today).flatMap(l => byName.get(l.exercise)?.muscles ?? []),
  )
  const levels = computeMuscleFatigue(logs, exercises)
  return Object.entries(levels)
    .filter(([muscle, level]) => level >= OVERWORKED_MIN_LEVEL && recentlyTrained.has(muscle))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, OVERWORKED_TOP)
    .map(([muscle]) => MUSCLE_LABELS[muscle] ?? muscle)
}

// 운동 리스트(exercises)에 있는 운동만, 반환은 운동 id 배열(가장 최근에 한 순서)
export function strugglingExercises(logs, exercises, now = new Date()) {
  const since = daysAgoStr(STRUGGLING_DAYS, now)
  const today = dateStr(now)
  const byName = new Map(exercises.map(e => [e.name, e]))
  const byExercise = new Map()
  logs
    .filter(l => isDone(l) && Number(l.targetReps) > 0 && l.date >= since && l.date <= today && byName.has(l.exercise))
    .forEach(l => byExercise.set(l.exercise, [...(byExercise.get(l.exercise) ?? []), l]))

  const out = []
  for (const [name, list] of byExercise) {
    const recent = list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, STRUGGLING_SESSIONS)
    if (recent.length < STRUGGLING_SESSIONS) continue
    const missed = l => Math.min(...l.performedSets.map(s => Number(s.reps) || 0)) < Number(l.targetReps)
    if (recent.every(missed)) out.push({ id: byName.get(name).id, last: recent[0].date })
  }
  return out
    .sort((a, b) => b.last.localeCompare(a.last) || a.id.localeCompare(b.id))
    .slice(0, STRUGGLING_TOP)
    .map(o => o.id)
}
