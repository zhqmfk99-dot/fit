// 분할 루틴 한 번에 만들기 — 웹앱·PWA 공용 로직(UI 아님). AI 없이 규칙으로만 정하므로 같은 입력이면 항상 같은 결과다.
//
// "분할 프리셋"(예: 등+어깨 / 팔 / 가슴+하체)을 고르면 요일마다 루틴을 하나씩 만든다. 운동은 운동 리스트에서 부위별로 고른다:
//   · 부위 묶음: 가슴·등·어깨·팔·하체·코어. 운동의 **주 근육(근육 목록의 첫 번째)**이 그 묶음에 들면 그 부위 운동으로 본다(주 근육 가정 — seed 기준).
//   · 하루 운동 수(기본 5개)를 그날의 부위들에 고르게 나눈다(부위가 운동 수보다 많으면 부위마다 1개). 후보가 모자란 부위의 몫은 다른 부위가 채운다.
//   · 부위 안에서는 **복합관절을 먼저**, 그다음 점수순: 최근 90일에 서로 다른 날 한 횟수 × 3 + 복합관절 +2. 같은 점수는 이름순.
//     같은 주 근육 운동은 처음에는 2개까지만 고르고, 자리가 남으면 그다음에 채운다.
//   · 내 운동기구(설정)를 고른 경우 그 기구의 운동과 맨몸만 후보로 한다(장비 정보가 없는 운동은 항상 후보).
//   · 하루 안의 순서: 복합관절 → 단관절 (부위 순서 유지) — 루틴 점검의 "단관절이 복합관절보다 앞에" 규칙과 맞춘다.
//   · 세트·횟수·휴식 기본값: 복합관절 3×8·120초, 맨몸 복합 3×10·90초, 단관절 3×12·60초, 코어 3×15·45초. 무게는 내가 마지막으로 한 무게(없으면 비움).
// ※ 부위 묶음·기본 세트/횟수/휴식·점수 가중치는 흔히 쓰는 값으로 정한 가정이다(아래 상수).

import { lastWeightFor } from './lastWeight.js'

export const SPLIT_GROUPS = ['가슴', '등', '어깨', '팔', '하체', '코어']
export const GROUP_MUSCLES = {
  가슴: ['chest'],
  등: ['upper-back', 'lower-back', 'trapezius'],
  어깨: ['front-deltoids', 'back-deltoids'],
  팔: ['biceps', 'triceps', 'forearm'],
  하체: ['quadriceps', 'hamstring', 'gluteal', 'adductor', 'abductors', 'calves'],
  코어: ['abs', 'obliques'],
}
export const PER_DAY_OPTIONS = [4, 5, 6]
export const DEFAULT_PER_DAY = 5
export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']
const HISTORY_DAYS = 90
const USAGE_WEIGHT = 3
const COMPOUND_BONUS = 2
const PRIMARY_CAP = 2

export const BUILTIN_PRESETS = [
  { id: 'back-shoulder-arm-chestleg', name: '등+어깨 / 팔 / 가슴+하체', days: [{ groups: ['등', '어깨'] }, { groups: ['팔'] }, { groups: ['가슴', '하체'] }] },
  { id: 'push-pull-leg', name: '푸시 / 풀 / 레그', days: [{ label: '푸시', groups: ['가슴', '어깨'] }, { label: '풀', groups: ['등', '팔'] }, { label: '레그', groups: ['하체', '코어'] }] },
  { id: 'upper-lower', name: '상체 / 하체', days: [{ label: '상체', groups: ['가슴', '등', '어깨', '팔'] }, { label: '하체', groups: ['하체', '코어'] }] },
  { id: 'four-split', name: '가슴 / 등 / 하체 / 어깨+팔', days: [{ groups: ['가슴'] }, { groups: ['등'] }, { groups: ['하체'] }, { groups: ['어깨', '팔'] }] },
]

export const dayLabel = day => day.label || day.groups.join('+')

// ── 내가 저장한 프리셋(설정 splitPresets) ───────────────────────
export const MAX_CUSTOM_PRESETS = 5
export const MAX_PRESET_DAYS = 7
export const MAX_DAY_GROUPS = 3
export const MAX_PRESET_NAME = 20

// 저장된 값을 믿지 않고 형식·범위를 맞춘다: 이름 1~20자, 요일 1~7개, 요일마다 알려진 부위 1~3개(중복 제거), 최대 5개 프리셋
export function sanitizePresets(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const p of raw) {
    if (!p || typeof p !== 'object' || out.length >= MAX_CUSTOM_PRESETS) continue
    const name = typeof p.name === 'string' ? p.name.trim().slice(0, MAX_PRESET_NAME) : ''
    const days = (Array.isArray(p.days) ? p.days : [])
      .slice(0, MAX_PRESET_DAYS)
      .map(d => ({ groups: [...new Set((Array.isArray(d?.groups) ? d.groups : []).filter(g => SPLIT_GROUPS.includes(g)))].slice(0, MAX_DAY_GROUPS) }))
      .filter(d => d.groups.length)
    if (!name || !days.length) continue
    out.push({ id: typeof p.id === 'string' && p.id ? p.id.slice(0, 40) : `custom-${out.length}`, name, days })
  }
  return out
}

// ── 운동 고르기 ─────────────────────────────────────────────
const primaryOf = e => (e.muscles || [])[0]
const groupOfExercise = e => SPLIT_GROUPS.find(g => GROUP_MUSCLES[g].includes(primaryOf(e))) ?? null

const pad = n => String(n).padStart(2, '0')
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// 최근 90일에 서로 다른 날 한 횟수(운동 이름별)
function usageCounts(logs, now) {
  const since = new Date(now)
  since.setDate(since.getDate() - HISTORY_DAYS)
  const from = dateStr(since)
  const days = new Map()
  for (const l of logs) {
    if (!l.isCompleted || !l.performedSets?.length || l.date < from) continue
    if (!days.has(l.exercise)) days.set(l.exercise, new Set())
    days.get(l.exercise).add(l.date)
  }
  return new Map([...days].map(([name, set]) => [name, set.size]))
}

const isCompound = e => e.exerciseType === '복합관절'
const rank = (usage, e) => (usage.get(e.name) || 0) * USAGE_WEIGHT + (isCompound(e) ? COMPOUND_BONUS : 0)
const byRank = usage => (a, b) => rank(usage, b) - rank(usage, a) || a.name.localeCompare(b.name, 'ko')

// 하루치 운동 고르기: 반환 [{ exercise(리스트 객체), group }] — 복합관절 → 단관절 순
export function pickDay(groups, catalog, logs, { perDay = DEFAULT_PER_DAY, myEquipment = [], now = new Date() } = {}) {
  const usage = usageCounts(logs, now)
  const mine = myEquipment.length ? new Set([...myEquipment, '맨몸']) : null
  const usable = e => !mine || !e.equipment || mine.has(e.equipment)
  const total = Math.max(perDay, groups.length)
  const base = Math.floor(total / groups.length)
  const extra = total % groups.length

  const picked = []
  const used = new Set()
  groups.forEach((g, gi) => {
    const want = base + (gi < extra ? 1 : 0)
    const cand = catalog.filter(e => groupOfExercise(e) === g && usable(e)).sort(byRank(usage))
    const perPrimary = new Map()
    for (const e of cand) {
      if (picked.filter(p => p.group === g).length >= want) break
      const pm = primaryOf(e)
      if ((perPrimary.get(pm) || 0) >= PRIMARY_CAP) continue
      perPrimary.set(pm, (perPrimary.get(pm) || 0) + 1)
      picked.push({ exercise: e, group: g })
      used.add(e.name)
    }
    for (const e of cand) {
      if (picked.filter(p => p.group === g).length >= want) break
      if (!used.has(e.name)) {
        picked.push({ exercise: e, group: g })
        used.add(e.name)
      }
    }
  })
  // 후보가 모자란 부위의 몫은 남은 후보(다른 부위)로 채운다
  if (picked.length < total) {
    const rest = catalog.filter(e => groups.includes(groupOfExercise(e)) && usable(e) && !used.has(e.name)).sort(byRank(usage))
    for (const e of rest) {
      if (picked.length >= total) break
      picked.push({ exercise: e, group: groupOfExercise(e) })
    }
  }
  // 복합관절 먼저(부위 순서·점수 순서는 그대로)
  const idx = new Map(picked.map((p, i) => [p, i]))
  return [...picked].sort((a, b) => Number(isCompound(b.exercise)) - Number(isCompound(a.exercise)) || idx.get(a) - idx.get(b))
}

// 휴식은 설정의 "기본 휴식 시간"(baseRest)을 기준으로 운동 종류별로 얹거나 뺀다: 기구 복합관절 +30초, 맨몸 복합관절 ±0, 단관절 −30초, 코어 −45초.
// 기본값 90초일 때 예전 고정값(120·90·60·45초)과 같다. 5초 단위, 30~300초.
export const SPLIT_BASE_REST = 90
const restFrom = (base, offset) => Math.min(300, Math.max(30, Math.round((base + offset) / 5) * 5))

// 운동 하나의 기본 세트·횟수·휴식
export function defaultsFor(e, group, baseRest = SPLIT_BASE_REST) {
  const base = Number.isFinite(Number(baseRest)) && Number(baseRest) > 0 ? Number(baseRest) : SPLIT_BASE_REST
  if (group === '코어') return { sets: 3, reps: 15, restSeconds: restFrom(base, -45) }
  if (isCompound(e)) return e.equipment === '맨몸' ? { sets: 3, reps: 10, restSeconds: restFrom(base, 0) } : { sets: 3, reps: 8, restSeconds: restFrom(base, 30) }
  return { sets: 3, reps: 12, restSeconds: restFrom(base, -30) }
}

// 분할 전체 계획: [{ label, groups, items: [{ exercise, sets, reps, restSeconds, weight(number|null), equipment, needsWeight, unilateral }] }]
//   weight: 내가 마지막으로 한 무게(없으면 null). needsWeight: 무게가 필요한 운동(맨몸이 아님)인데 기록이 없어 비어 있음
export function planSplit(preset, catalog, logs, opts = {}) {
  return preset.days.map(day => ({
    label: dayLabel(day),
    groups: day.groups,
    items: pickDay(day.groups, catalog, logs, opts).map(({ exercise: e, group }) => {
      const weight = lastWeightFor(e.name, logs)
      return { exercise: e.name, ...defaultsFor(e, group, opts.baseRest), weight, equipment: e.equipment || '', needsWeight: weight == null && e.equipment !== '맨몸', unilateral: !!e.unilateral }
    }),
  }))
}

// ── 요일 배정 ───────────────────────────────────────────────
const DEFAULT_WEEKDAYS = { 1: ['월'], 2: ['월', '목'], 3: ['월', '수', '금'], 4: ['월', '화', '목', '금'], 5: ['월', '화', '수', '목', '금'], 6: ['월', '화', '수', '목', '금', '토'], 7: WEEKDAYS }
export const defaultWeekdays = count => [...(DEFAULT_WEEKDAYS[Math.min(7, Math.max(1, count))] ?? [])]

// ── 루틴 만들기 ─────────────────────────────────────────────
// plan: planSplit 결과(운동을 뺀 날은 items가 비어 있을 수 있다) / weekdays: 날마다 배정한 요일(문자열 배열의 배열) / weights: { 운동 이름: 입력한 무게(문자열) }
// 같은 이름의 루틴이 이미 있으면 "(2)"처럼 번호를 붙인다. 비어 있는 날(운동 후보 없음)은 만들지 않는다.
export function buildRoutines(plan, { weekdays = [], weights = {}, existingNames = [], defaultRest = 90, newId = () => crypto.randomUUID() } = {}) {
  const taken = new Set(existingNames)
  const out = []
  plan.forEach((day, i) => {
    if (!day.items.length) return
    let name = day.label
    for (let n = 2; taken.has(name); n++) name = `${day.label} (${n})`
    taken.add(name)
    const days = (weekdays[i] || []).filter(d => WEEKDAYS.includes(d))
    out.push({
      id: newId(),
      name,
      isActive: true,
      repeatDays: WEEKDAYS.filter(d => days.includes(d)),
      exercises: day.items.map(it => {
        const typed = Number(weights[it.exercise])
        return { exercise: it.exercise, sets: it.sets, reps: it.reps, weight: it.weight ?? (Number.isFinite(typed) && typed > 0 ? typed : 0), restSeconds: it.restSeconds || defaultRest, linkedToNext: false }
      }),
    })
  })
  return out
}
