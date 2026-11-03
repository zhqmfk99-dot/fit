import { useMemo, useState } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { BUILTIN_PRESETS, DEFAULT_PER_DAY, MAX_CUSTOM_PRESETS, MAX_PRESET_DAYS, MAX_DAY_GROUPS, MAX_PRESET_NAME, defaultWeekdays, planSplit, buildRoutines, sanitizePresets } from '../lib/splitPlan.js'

const emptyDraft = () => ({ id: null, name: '', days: [{ groups: [] }, { groups: [] }, { groups: [] }] })

// 루틴 화면(웹앱·PWA)의 "분할로 한 번에 만들기" 상태·로직. 운동 고르기 규칙은 lib/splitPlan.js.
//   view: 'pick'(프리셋 고르기) → 'preview'(미리보기·요일·무게) → 'done'(만들기 끝) / 'edit'(내 분할 만들기·고치기)
export function useSplitPlanner() {
  const { logs, routines, setRoutines, exercises } = useWorkoutLogs()
  const { settings, update } = useSettings()
  const [view, setView] = useState('pick')
  const [presetId, setPresetId] = useState(null)
  const [perDay, setPerDay] = useState(DEFAULT_PER_DAY)
  const [weekdays, setWeekdays] = useState([]) // 날마다 배정한 요일 [['월'], ['수'], …]
  const [weights, setWeights] = useState({})
  const [draft, setDraft] = useState(emptyDraft)
  const [draftError, setDraftError] = useState('')
  const [done, setDone] = useState(null) // { routines: n, exercises: n, missingWeight: n }

  const custom = settings.splitPresets ?? []
  const presets = useMemo(() => [...BUILTIN_PRESETS, ...custom], [custom])
  const preset = presets.find(p => p.id === presetId) ?? null

  const plan = useMemo(
    () => (preset ? planSplit(preset, exercises, logs, { perDay, myEquipment: settings.myEquipment ?? [], baseRest: settings.defaultRestSeconds, now: new Date() }) : []),
    [preset, exercises, logs, perDay, settings.myEquipment, settings.defaultRestSeconds],
  )

  const choose = id => {
    const p = presets.find(x => x.id === id)
    if (!p) return
    setPresetId(id)
    setWeights({})
    setWeekdays(defaultWeekdays(p.days.length).map(d => [d])) // 날마다 요일 하나씩(2일이면 월·목, 3일이면 월·수·금 …)
    setView('preview')
  }

  const toggleWeekday = (dayIndex, wd) =>
    setWeekdays(prev => prev.map((days, i) => (i === dayIndex ? (days.includes(wd) ? days.filter(d => d !== wd) : [...days, wd]) : days)))
  const setWeight = (name, v) => setWeights(prev => ({ ...prev, [name]: v }))

  const missingWeight = plan.flatMap(d => d.items).filter(it => it.needsWeight && !(Number(weights[it.exercise]) > 0)).length
  const routineCount = plan.filter(d => d.items.length).length

  // 만들기: 무게가 필요한 운동인데 비어 있으면(맨몸으로 기록됨) 루틴 등록 화면과 같이 한 번 확인한다
  const create = () => {
    if (!routineCount) return
    if (
      missingWeight > 0 &&
      !confirm(`무게가 비어 있는 운동이 ${missingWeight}개 있어요.\n그대로 만들면 맨몸 운동으로 기록되고, 앱이 무게를 올려 주지 못해요.\n(만든 뒤 루틴 수정에서 입력할 수 있어요.) 그래도 만들까요?`)
    )
      return
    const made = buildRoutines(plan, { weekdays, weights, existingNames: routines.map(r => r.name), defaultRest: settings.defaultRestSeconds })
    setRoutines(prev => [...made, ...prev])
    setDone({ routines: made.length, exercises: made.reduce((a, r) => a + r.exercises.length, 0), missingWeight })
    setView('done')
  }

  // ── 내 분할 만들기·저장 ──
  const startEdit = id => {
    const p = custom.find(x => x.id === id)
    setDraft(p ? { id: p.id, name: p.name, days: p.days.map(d => ({ groups: [...d.groups] })) } : emptyDraft())
    setDraftError('')
    setView('edit')
  }
  const setDraftName = name => setDraft(d => ({ ...d, name: name.slice(0, MAX_PRESET_NAME) }))
  const toggleDraftGroup = (dayIndex, group) =>
    setDraft(d => ({
      ...d,
      days: d.days.map((day, i) => {
        if (i !== dayIndex) return day
        if (day.groups.includes(group)) return { groups: day.groups.filter(g => g !== group) }
        return day.groups.length >= MAX_DAY_GROUPS ? day : { groups: [...day.groups, group] }
      }),
    }))
  const addDraftDay = () => setDraft(d => (d.days.length >= MAX_PRESET_DAYS ? d : { ...d, days: [...d.days, { groups: [] }] }))
  const removeDraftDay = i => setDraft(d => (d.days.length <= 1 ? d : { ...d, days: d.days.filter((_, k) => k !== i) }))

  const saveDraft = () => {
    const cleaned = sanitizePresets([{ id: draft.id || `custom-${crypto.randomUUID()}`, name: draft.name, days: draft.days }])[0]
    if (!draft.name.trim()) return setDraftError('분할 이름을 입력해 주세요.')
    if (!cleaned) return setDraftError('요일마다 부위를 하나 이상 골라 주세요.')
    if (cleaned.days.length < draft.days.filter(d => d.groups.length).length) return setDraftError('저장할 수 없는 부위가 있어요.')
    if (!draft.id && custom.length >= MAX_CUSTOM_PRESETS) return setDraftError(`내 분할은 ${MAX_CUSTOM_PRESETS}개까지 저장할 수 있어요. 하나를 지우고 다시 저장해 주세요.`)
    setDraftError('')
    update({ splitPresets: draft.id ? custom.map(p => (p.id === draft.id ? cleaned : p)) : [...custom, cleaned] })
    setPresetId(cleaned.id)
    setWeights({})
    setWeekdays(defaultWeekdays(cleaned.days.length).map(d => [d]))
    setView('preview')
  }
  const deleteCustom = id => {
    const p = custom.find(x => x.id === id)
    if (!p || !confirm(`"${p.name}" 분할을 삭제할까요? (이미 만든 루틴은 그대로예요.)`)) return
    update({ splitPresets: custom.filter(x => x.id !== id) })
  }

  return {
    view, setView, presets, custom, preset, perDay, setPerDay, plan, weekdays, toggleWeekday, weights, setWeight,
    missingWeight, routineCount, choose, create, done,
    draft, draftError, startEdit, setDraftName, toggleDraftGroup, addDraftDay, removeDraftDay, saveDraft, deleteCustom,
  }
}
