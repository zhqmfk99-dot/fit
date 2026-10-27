// AI 루틴 만들어주기 — 웹앱·PWA 공용 로직 (UI 아님)
// 서버 함수(/api/generate-routine)를 부르고, 받은 결과를 루틴 등록 화면에 채울 초안으로 바꾼다.
// AI는 운동 id·세트·횟수·휴식만 정한다. 무게는 AI가 정하지 않고, 내가 전에 한 기록이 있으면 그 무게를 쓴다(없으면 비워 둔다).

import { supabase } from './supabase.js'
import { MUSCLE_LABELS, UPPER_BODY_MUSCLES, LOWER_BODY_MUSCLES } from './muscleMap.js'
import { calcBmi } from './bodyMetrics.js'

export const AI_GOALS = ['근비대', '근력', '체지방 감량', '체력 유지']
export const AI_MAX_GOALS = 3 // 목표는 여러 개 고를 수 있다(서버 MAX_GOALS와 같아야 한다). 여러 개면 AI가 운동마다 나눠 섞는다.
// 조건 객체에서 목표 배열을 꺼낸다(예전 형식인 단일 `goal`도 받는다)
export const goalsOf = conditions => (Array.isArray(conditions?.goals) ? conditions.goals : conditions?.goal ? [conditions.goal] : [])
export const AI_LEVELS = ['초보', '중급', '상급']
// 집중 부위: 부위별 분할(예: 등+어깨 / 팔 / 가슴+하체)로 고르기 쉽게 부위 단위로 둔다. 상체·하체는 큰 분류라 부위와 겹쳐 고르면 중복이 된다(여러 개 선택은 허용).
// 더 구체적으로 정하려면 "세부 부위"(고른 부위를 쓰는 운동만 후보로 보냄)를 쓴다. 서버 FOCUS와 같아야 한다.
export const AI_FOCUS = ['전신', '상체', '하체', '가슴', '등', '어깨', '팔(이두·삼두·전완)', '코어']
export const AI_MINUTES = [30, 45, 60, 90]
export const AI_NOTES_MAX = 200
export const AI_INSTRUCTION_MAX = 200
// 루틴 수정 요청 상자의 빠른 문구(누르면 입력칸에 채워진다)
export const AI_REFINE_SUGGESTIONS = ['운동 수를 줄여 주세요', '조금 더 쉽게 해 주세요', '하체 운동을 늘려 주세요', '코어 운동을 추가해 주세요']

export const AI_MAX_INCLUDE = 5
export const AI_MIN_CANDIDATES = 4 // 후보 운동이 이보다 적으면 루틴을 만들 수 없다고 보고 호출하지 않는다

// 세부 부위 선택지(상체/하체로 묶어서 보여준다). 값은 운동 리스트의 근육 슬러그, 화면에는 한글 이름.
export const AI_MUSCLE_GROUPS = [
  { label: '상체', muscles: UPPER_BODY_MUSCLES },
  { label: '하체', muscles: LOWER_BODY_MUSCLES },
]
export const muscleLabel = slug => MUSCLE_LABELS[slug] ?? slug
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
// 세부 부위(muscleSlugs)를 골랐으면 그 부위를 하나라도 쓰는 운동만 남긴다(하드 필터).
// 꼭 넣을 운동은 장비·부위 선택과 상관없이 항상 목록에 둔다.
export function buildCatalogPayload(exercises, equipment, avoidIds = [], includeIds = [], muscleSlugs = []) {
  return exercises
    .filter(e => !avoidIds.includes(e.id))
    .filter(
      e =>
        includeIds.includes(e.id) ||
        ((!equipment.length || !e.equipment || equipment.includes(e.equipment)) && (!muscleSlugs.length || (e.muscles || []).some(m => muscleSlugs.includes(m)))),
    )
    .map(e => ({
      id: e.id,
      name: e.name,
      muscles: (e.muscles || []).map(m => MUSCLE_LABELS[m] ?? m),
      equipment: e.equipment || '',
      pattern: e.movementPattern || '',
      type: e.exerciseType || '',
      unilateral: !!e.unilateral, // 한쪽씩 하는 운동 — 횟수가 한쪽 기준이라는 것을 AI가 알도록 함께 보낸다
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
// goalHint: 내 목표에서 계산한 { direction, level }(lib/bodyGoal.js) — 목표 숫자는 보내지 않고 이 방향·크기만 체형 정보와 함께 보낸다
export async function fetchBodyInfo(userId, bodyRecords, goalHint = null) {
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
    bodyFatPct: latest('bodyFatPct') ?? null, // 가장 최근 신체 기록의 체지방률(목표를 섞는 비중을 정할 때 쓴다)
    goalHint: goalHint || null,
  }
  return Object.values(info).some(v => v != null) ? info : null
}

export async function requestRoutineDraft(conditions, exercises, extra = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('로그인이 필요합니다.')

  // 장비·부위·빼고 싶은 운동을 반영한 후보 목록. 너무 적으면 호출하지 않는다(호출 한도·비용 낭비 방지).
  const slugs = conditions.muscles || []
  // 수정 요청이면 지금 루틴의 운동은 장비·부위 필터와 상관없이 목록에 남겨 둔다(그래야 서버가 현재 루틴을 알아볼 수 있다)
  const keepIds = [...(extra.include || []), ...(extra.current || []).map(c => c.id)]
  const catalog = buildCatalogPayload(exercises, conditions.equipment || [], extra.avoid || [], keepIds, slugs)
  if (catalog.length < AI_MIN_CANDIDATES) {
    throw new Error(`조건에 맞는 운동이 ${catalog.length}개뿐이라 루틴을 만들기 어려워요. 장비나 세부 부위를 넓히거나, 운동 리스트에 운동을 더 등록해 주세요.`)
  }

  return postToAi(token, {
    goals: goalsOf(conditions),
    level: conditions.level,
    minutes: conditions.minutes,
    focus: conditions.focus,
    muscles: slugs.map(muscleLabel),
    notes: conditions.notes,
    exercises: catalog,
    include: extra.include || [],
    current: extra.current || undefined,
    instruction: extra.instruction || undefined,
    history: extra.history || null,
    body: extra.body || null,
  }, 'AI 루틴 생성에 실패했어요.')
}

// 서버 함수(/api/generate-routine)에 요청을 보내고 JSON을 돌려준다. 실패하면 화면에 보일 문구로 던진다.
async function postToAi(token, payload, failMessage) {
  let res
  try {
    res = await fetch('/api/generate-routine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.')
  }
  const json = await res.json().catch(() => null)
  if (!json) throw new Error('서버 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.')
  if (!res.ok) throw new Error(json.error || failMessage)
  return json
}

// ── 루틴 검토(내가 고른 운동이 적절한지 AI가 판정) ─────────────────

export const REVIEW_MAX_EXERCISES = 12 // 서버(MAX_CURRENT)와 같아야 한다

// conditions: { goals, level, focus, equipment }(모두 선택) / current: currentForRefine()의 결과
// 대체 운동 후보는 운동 리스트에서 쓸 수 있는 장비로 거른 목록이다(현재 루틴의 운동은 장비와 상관없이 포함). 현재 루틴 운동을 앞에 둔다.
export async function requestRoutineReview(conditions, exercises, current) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('로그인이 필요합니다.')
  const ids = current.map(c => c.id)
  const catalog = buildCatalogPayload(exercises, conditions.equipment || [], [], ids, [])
  catalog.sort((a, b) => Number(ids.includes(b.id)) - Number(ids.includes(a.id)))
  if (catalog.length < 3) throw new Error('비교할 운동이 부족해요. 운동 리스트에 운동을 더 등록하거나 장비 선택을 넓혀 주세요.')
  return postToAi(token, { review: true, goals: goalsOf(conditions), level: conditions.level || undefined, focus: conditions.focus || [], exercises: catalog, current }, 'AI 루틴 검토에 실패했어요.')
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

// ── 루틴 수정 요청(채팅형 다듬기) ───────────────────────────────

// 지금 등록 화면의 운동 행들 → 서버로 보낼 현재 루틴(운동 리스트에 있는 이름만 id로 바꿔서)
export function currentForRefine(rows, exercises) {
  return rows
    .filter(r => r.exercise?.trim())
    .map(r => {
      const e = exercises.find(c => c.name === r.exercise.trim())
      return e ? { id: e.id, sets: Number(r.sets) || 3, reps: Number(r.reps) || 8, restSeconds: Number(r.restSeconds) || 60, linkedToNext: !!r.linkedToNext } : null
    })
    .filter(Boolean)
}

// 수정된 서버 결과를 지금 화면의 행들과 합친다.
//  - 이어지는 운동은 사용자가 입력해 둔 무게를 그대로 둔다(AI는 무게를 바꾸지 않는다). 새로 들어온 운동의 무게는 내 기록에서, 없으면 빈칸.
//  - 운동 리스트에 없는 이름(직접 입력한 운동)은 AI가 모르므로 맨 뒤에 그대로 붙인다.
export function mergeRefined(result, rows, exercises, logs) {
  const byId = new Map(exercises.map(e => [e.id, e]))
  const items = (result.exercises || [])
    .filter(e => byId.has(e.id))
    .map(e => {
      const name = byId.get(e.id).name
      const old = rows.find(r => r.exercise?.trim() === name)
      return { ...(old || {}), exercise: name, sets: e.sets, reps: e.reps, weight: old ? old.weight : (lastWeightFor(name, logs) ?? ''), restSeconds: e.restSeconds, linkedToNext: !!e.linkedToNext }
    })
  const unknown = rows.filter(r => r.exercise?.trim() && !exercises.some(c => c.name === r.exercise.trim()))
  const all = [...items, ...unknown]
  if (all.length) all[all.length - 1] = { ...all[all.length - 1], linkedToNext: false }
  return all
}
