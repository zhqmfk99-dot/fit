// 운동 진행 중 세트 기록의 임시 저장 — PWA 운동 진행 화면(WorkoutSession)이 쓴다. UI 아님.
//
// 운동 하나의 세트 기록은 그 운동의 마지막 세트를 끝낼 때 서버에 저장된다. 그 전에 앱이 종료되거나(음악 앱으로 전환했다가 OS가 앱을 내리는 경우 등)
// 새로고침되면 지금까지 한 세트가 사라지므로, 세트를 끝내거나 고칠 때마다 이 기기(localStorage)에 임시 저장해 두고
// 세션 화면을 다시 열면 "이어서 하기"를 물어본다. 서버에는 올리지 않는다(기기 안에서만).
//
// 저장 모양: { v: 1, savedAt: ms, performedByLog: { [logId]: [{ reps, weight, durationSeconds, restBeforeSeconds, startedAt, endedAt }, …] } }
// 키: fit-session-draft:<사용자>:<루틴 id>:<날짜>

const PREFIX = 'fit-session-draft:'
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000 // 사흘이 지난 임시 저장은 버린다

const defaultStorage = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null // 저장소를 못 쓰는 환경(사생활 보호 모드 등)이면 임시 저장 없이 동작
  }
}

export const draftKey = (userId, routineId, date) => `${PREFIX}${userId || 'anon'}:${routineId}:${date}`

const num = v => typeof v === 'number' && Number.isFinite(v)
const validSet = s => s && typeof s === 'object' && num(s.reps) && num(s.weight) && s.reps >= 0 && s.weight >= 0

// 아직 끝나지 않은 운동의 세트만 남기고, 비어 있으면 임시 저장을 지운다
export function saveDraft(key, performedByLog, { storage = defaultStorage(), now = Date.now() } = {}) {
  if (!storage) return false
  try {
    const entries = Object.entries(performedByLog || {}).filter(([, sets]) => Array.isArray(sets) && sets.length > 0)
    if (!entries.length) {
      storage.removeItem(key)
      return false
    }
    storage.setItem(key, JSON.stringify({ v: 1, savedAt: now, performedByLog: Object.fromEntries(entries) }))
    return true
  } catch {
    return false // 용량 초과 등 — 임시 저장을 못 해도 운동 진행에는 영향 없음
  }
}

// 지금 기록(logs)과 맞는 임시 저장만 돌려준다. 없거나 형식이 이상하거나 오래됐으면 null.
//  - 이미 끝낸 운동·없어진 운동·세트가 목표 이상인 운동(이미 끝났어야 할 기록)은 뺀다
export function loadDraft(key, logs, { storage = defaultStorage(), now = Date.now() } = {}) {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || d.v !== 1 || !num(d.savedAt) || now - d.savedAt > MAX_AGE_MS || !d.performedByLog || typeof d.performedByLog !== 'object') return null
    const kept = {}
    for (const [id, sets] of Object.entries(d.performedByLog)) {
      const log = logs.find(l => l.id === id)
      if (!log || log.isCompleted || !Array.isArray(sets) || !sets.length || !sets.every(validSet)) continue
      if (sets.length >= (log.targetSets || 1)) continue
      kept[id] = sets
    }
    return Object.keys(kept).length ? { savedAt: d.savedAt, performedByLog: kept } : null
  } catch {
    return null
  }
}

export function clearDraft(key, { storage = defaultStorage() } = {}) {
  try {
    storage?.removeItem(key)
  } catch {
    /* 무시 */
  }
}

// 오래됐거나 읽을 수 없는 임시 저장을 정리한다(세션 화면을 열 때 한 번)
export function pruneOldDrafts({ storage = defaultStorage(), now = Date.now() } = {}) {
  if (!storage) return 0
  let removed = 0
  try {
    const keys = []
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (k && k.startsWith(PREFIX)) keys.push(k)
    }
    for (const k of keys) {
      let drop = false
      try {
        const d = JSON.parse(storage.getItem(k))
        drop = !d || d.v !== 1 || !num(d.savedAt) || now - d.savedAt > MAX_AGE_MS
      } catch {
        drop = true
      }
      if (drop) {
        storage.removeItem(k)
        removed++
      }
    }
  } catch {
    /* 무시 */
  }
  return removed
}

// 안내 문구용: [{ exercise, sets }]
export function draftSummary(draft, logs) {
  return Object.entries(draft.performedByLog).map(([id, sets]) => ({ exercise: logs.find(l => l.id === id)?.exercise ?? '', sets: sets.length }))
}

// 이어서 할 지점: 그룹의 세트 진행 순서(flatSteps)에서 아직 기록이 없는 첫 단계의 인덱스. 모두 기록돼 있으면 -1.
export const resumeStepIndex = (flatSteps, performedByLog) => flatSteps.findIndex(s => s.round >= (performedByLog[s.logId]?.length || 0))
