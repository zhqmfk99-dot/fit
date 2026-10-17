// AI 루틴 만들어주기 — 웹앱·PWA 공용 로직 (UI 아님)
// 서버 함수(/api/generate-routine)를 부르고, 받은 결과를 루틴 등록 화면에 채울 초안으로 바꾼다.
// AI는 운동 id·세트·횟수·휴식만 정한다. 무게는 AI가 정하지 않고, 내가 전에 한 기록이 있으면 그 무게를 쓴다(없으면 비워 둔다).

import { supabase } from './supabase.js'
import { MUSCLE_LABELS } from './muscleMap.js'

export const AI_GOALS = ['근비대', '근력', '체지방 감량', '체력 유지']
export const AI_LEVELS = ['초보', '중급', '상급']
export const AI_FOCUS = ['전신', '상체', '하체', '밀기(가슴·어깨·삼두)', '당기기(등·이두)', '코어']
export const AI_MINUTES = [30, 45, 60, 90]
export const AI_NOTES_MAX = 200

// 서버로 보낼 운동 목록: 고른 장비로 거른다(아무것도 안 골랐으면 전체). 장비 정보가 없는 운동은 항상 포함.
export function buildCatalogPayload(exercises, equipment) {
  return exercises
    .filter(e => !equipment.length || !e.equipment || equipment.includes(e.equipment))
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

export async function requestRoutineDraft(conditions, exercises) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('로그인이 필요합니다.')

  let res
  try {
    res = await fetch('/api/generate-routine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...conditions, exercises: buildCatalogPayload(exercises, conditions.equipment || []) }),
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
