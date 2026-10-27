// AI 루틴 만들어주기 — 웹앱·PWA 공용 로직 (UI 아님)
// 서버 함수(/api/generate-routine)를 부르고, 받은 결과를 루틴 등록 화면에 채울 초안으로 바꾼다.
// AI는 운동 id·세트·횟수·휴식만 정한다. 무게는 AI가 정하지 않고, 내가 전에 한 기록이 있으면 그 무게를 쓴다(없으면 비워 둔다).

import { supabase } from './supabase.js'
import { MUSCLE_LABELS } from './muscleMap.js'
import { calcBmi } from './bodyMetrics.js'

export const AI_GOALS = ['근비대', '근력', '체지방 감량', '체력 유지']
export const AI_LEVELS = ['초보', '중급', '상급']
export const AI_FOCUS = ['전신', '상체', '하체', '밀기(가슴·어깨·삼두)', '당기기(등·이두)', '코어']
export const AI_MINUTES = [30, 45, 60, 90]
export const AI_NOTES_MAX = 200

export const AI_MAX_INCLUDE = 5
const HISTORY_DAYS = 90
const RECENT_DAYS = 28
const MIN_RECENT_SESSIONS = 3 // 최근 4주에 운동한 날이 이보다 적으면 "적게 한 부위"를 판단할 근거가 부족하다
const FREQUENT_MIN_SESSIONS = 2
const FREQUENT_TOP = 8
const NEGLECTED_TOP = 4
// 안 쓴 부위가 여럿이면 큰 근육부터 보강 대상으로 앞세운다(상위 4개만 보내므로 순서가 중요). 이 목록에 없는 부위는 제외.
const NEGLECT_PRIORITY = [
  'chest', 'upper-back', 'quadriceps', 'hamstring', 'gluteal', 'front-deltoids', 'back-deltoids', 'lower-back',
  'biceps', 'triceps', 'abs', 'calves', 'trapezius', 'obliques', 'forearm', 'adductor', 'abductors',
]

// 서버로 보낼 운동 목록: 고른 장비로 거르고, 빼고 싶은 운동은 제외한다(아무것도 안 골랐으면 전체). 장비 정보가 없는 운동은 항상 포함.
// 꼭 넣을 운동은 장비 선택과 상관없이 항상 목록에 둔다.
export function buildCatalogPayload(exercises, equipment, avoidIds = [], includeIds = []) {
  return exercises
    .filter(e => !avoidIds.includes(e.id))
    .filter(e => includeIds.includes(e.id) || !equipment.length || !e.equipment || equipment.includes(e.equipment))
    .map(e => ({
      id: e.id,
      name: e.name,
      muscles: (e.muscles || []).map(m => MUSCLE_LABELS[m] ?? m),
      equipment: e.equipment || '',
      pattern: e.movementPattern || '',
      type: e.exerciseType || '',
    }))
}

// 이 운동을 마지막으로 했을 때의 무게(없으면 null). 목표 무게가 있으면 그것, 없으면 수행한 세트의 최대 무게.
export function lastWeightFor(exerciseName, logs) {
  const done = logs
    .filter(l => l.exercise === exerciseName && l.isCompleted && l.performedSets?.length)
    .sort((a, b) => b.date.localeCompare(a.date))
  const last = done[0]
  if (!last) return null
  const w = last.targetWeight || Math.max(...last.performedSets.map(s => s.weight || 0))
  return w > 0 ? w : null
}

const pad = n => String(n).padStart(2, '0')
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgoStr = (n, now) => {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  return dateStr(d)
}

// 내 운동 기록 요약(운동 이름·부위만 — 무게·횟수·날짜는 보내지 않는다):
//  - frequent: 최근 90일에 2번 이상(서로 다른 날) 한 운동 중 많이 한 순 상위 8개의 id → "선호하는 운동"으로 본다
//  - neglected: 최근 28일에 한 번도 안 쓴 부위 이름(운동한 날이 3일 이상일 때만 판단) → "보강할 부위"
// 근거가 부족하면 null.
export function buildHistorySummary(logs, exercises, now = new Date()) {
  const done = logs.filter(l => l.isCompleted && l.performedSets?.length)
  const byName = new Map(exercises.map(e => [e.name, e]))

  const since90 = daysAgoStr(HISTORY_DAYS, now)
  const daysByExercise = new Map()
  done.filter(l => l.date >= since90).forEach(l => {
    if (!daysByExercise.has(l.exercise)) daysByExercise.set(l.exercise, new Set())
    daysByExercise.get(l.exercise).add(l.date)
  })
  const frequent = [...daysByExercise.entries()]
    .filter(([name, days]) => byName.has(name) && days.size >= FREQUENT_MIN_SESSIONS)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, FREQUENT_TOP)
    .map(([name]) => byName.get(name).id)

  const since28 = daysAgoStr(RECENT_DAYS, now)
  const recent = done.filter(l => l.date >= since28)
  const recentDays = new Set(recent.map(l => l.date))
  let neglected = []
  if (recentDays.size >= MIN_RECENT_SESSIONS) {
    const used = new Set(recent.flatMap(l => byName.get(l.exercise)?.muscles || []))
    neglected = NEGLECT_PRIORITY.filter(m => !used.has(m)).map(m => MUSCLE_LABELS[m] ?? m)
    neglected = [...new Set(neglected)].slice(0, NEGLECTED_TOP)
  }
  return frequent.length || neglected.length ? { frequent, neglected } : null
}

// 체형 정보(사용자가 체크했을 때만 조회·전송): 키·몸무게는 가장 최근 신체 기록 → 없으면 "내 정보", 성별·나이는 "내 정보".
// 값이 하나도 없으면 null.
export async function fetchBodyInfo(userId, bodyRecords) {
  const { data: profile } = await supabase.from('profiles').select('gender, age, height_cm, weight_kg').eq('id', userId).maybeSingle()
  const latest = field =>
    [...bodyRecords]
      .filter(r => r[field])
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.[field]
  const heightCm = latest('heightCm') ?? (profile?.height_cm ? Number(profile.height_cm) : null)
  const weightKg = latest('weightKg') ?? (profile?.weight_kg ? Number(profile.weight_kg) : null)
  const info = {
    gender: profile?.gender === '남성' || profile?.gender === '여성' ? profile.gender : null,
    age: profile?.age ? Number(profile.age) : null,
    heightCm: heightCm ?? null,
    weightKg: weightKg ?? null,
    bmi: calcBmi(heightCm, weightKg),
  }
  return Object.values(info).some(v => v != null) ? info : null
}

export async function requestRoutineDraft(conditions, exercises, extra = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('로그인이 필요합니다.')

  let res
  try {
    res = await fetch('/api/generate-routine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...conditions,
        exercises: buildCatalogPayload(exercises, conditions.equipment || [], extra.avoid || [], extra.include || []),
        include: extra.include || [],
        history: extra.history || null,
        body: extra.body || null,
      }),
    })
  } catch {
    throw new Error('서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.')
  }
  const json = await res.json().catch(() => null)
  if (!json) throw new Error('서버 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.')
  if (!res.ok) throw new Error(json.error || 'AI 루틴 생성에 실패했어요.')
  return json
}

// 서버 결과 → 루틴 등록 화면에 채울 초안. (id가 운동 리스트에 없으면 버린다)
export function buildRoutineDraft(result, exercises, logs, repeatDays) {
  const byId = new Map(exercises.map(e => [e.id, e]))
  const items = (result.exercises || [])
    .filter(e => byId.has(e.id))
    .map(e => {
      const name = byId.get(e.id).name
      return {
        exercise: name,
        sets: e.sets,
        reps: e.reps,
        weight: lastWeightFor(name, logs) ?? '',
        restSeconds: e.restSeconds,
        linkedToNext: !!e.linkedToNext,
      }
    })
  if (items.length) items[items.length - 1].linkedToNext = false
  return { name: result.name, isActive: true, repeatDays, exercises: items, note: result.summary || '' }
}
