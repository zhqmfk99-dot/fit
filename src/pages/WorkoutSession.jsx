import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { X, Check, Link2, Flame, PersonStanding, ArrowLeftRight, SkipForward, Flag, Plus, Minus } from 'lucide-react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { notifyRestEnd, unlockAudio } from '../lib/restAlert.js'
import ExerciseGuide from '../components/web/ExerciseGuide.jsx'
import StretchModal from '../components/web/StretchModal.jsx'
import SwapExerciseModal from '../components/web/SwapExerciseModal.jsx'
import { sessionExcludeNames, routineExerciseNames, swapLogs, swapRoutine } from '../lib/exerciseSwap.js'
import { lastWeightFor } from '../lib/aiRoutine.js'
import { isSkipped } from '../lib/logStatus.js'
import { warmupSets, warmupTargetId, warmupText } from '../lib/warmupSets.js'
import { platesPerSide, platesText, BAR_KG } from '../lib/plateMath.js'
import { newRecordsOf, formatKg } from '../lib/exerciseStats.js'
import { stretchPlan, planMinutes } from '../lib/stretchGuide.js'
import { getRecentMaxWeight, estimateExerciseFatigue } from '../lib/workoutMetrics.js'
import { useDayKcal } from '../hooks/useDayKcal.js'
import { useDayDuration } from '../hooks/useDayDuration.js'
import { formatDuration } from '../lib/workoutTime.js'
import { useAuth } from '../context/AuthContext.jsx'
import { draftKey, saveDraft, loadDraft, clearDraft, pruneOldDrafts, draftSummary, resumeStepIndex } from '../lib/sessionDraft.js'
import { evaluateSession, applyNextToPlan, findPrevLog, findPrevLogs, summarizePerformed, FEEL_LABELS, FEEL_KEYS } from '../lib/progression.js'

// 세트 진행 화면의 무게 ± 버튼이 한 번에 움직이는 크기(kg). 예전에는 2.5kg이었는데 1kg 단위로 세밀하게 맞출 수 있게 바꿨다.
const WEIGHT_STEP_KG = 1

// 평가 결과(올리기/유지/낮추기)에 따른 글자색·기호
const VERDICT_STYLE = {
  'weight-up': { color: 'text-letusBlue', icon: '▲' },
  'reps-up': { color: 'text-letusBlue', icon: '▲' },
  hold: { color: 'text-gray-500', icon: '＝' },
  deload: { color: 'text-orange-600', icon: '▼' },
  'reps-down': { color: 'text-orange-600', icon: '▼' },
  'sets-down': { color: 'text-orange-600', icon: '▼' },
}
// 체감 난이도 버튼: 고른 것의 색 (표준 색 클래스라 다크 모드가 자동 적용된다)
const FEEL_ON = {
  easy: 'bg-emerald-50 border-emerald-400 text-emerald-700',
  ok: 'bg-blue-50 border-letusBlue text-letusBlue',
  hard: 'bg-orange-50 border-orange-400 text-orange-700',
}
const kgLabel = w => (w ? `${w}kg` : '맨몸')

// 세션이 끝나거나 종료할 때 돌아갈 곳 — 모바일 기록 화면 (데스크탑 경로 /workout/log로 가면 헤더 없는 데스크탑 화면이 열린다)
const LOG_PATH = '/workout/log'
// 운동 하나에 오늘만 늘릴 수 있는 세트 수의 상한(실수로 눌러 끝없이 늘어나는 것을 막는다)
const MAX_SETS = 12

// disabled: 이미 끝낸 세트를 보기만 할 때 — 조절 버튼을 막고 흐리게 보인다
function StepperCard({ label, value, step, unit, onChange, disabled = false }) {
  return (
    <div className={`border rounded-2xl px-5 py-4 shadow-sm transition-colors ${disabled ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'}`}>
      <div className="text-ui-caption font-bold text-gray-400 mb-2">{label}</div>
      <div className="flex items-center justify-between">
        <button
          onClick={() => onChange(Math.max(0, value - step))}
          disabled={disabled}
          className={`w-12 h-12 rounded-full font-black text-xl flex items-center justify-center transition-colors ${
            disabled ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          −
        </button>
        <span className={`text-2xl font-black tabular-nums ${disabled ? 'text-gray-400' : 'text-gray-800'}`}>
          {value}
          {unit && <span className="text-ui-body font-bold text-gray-400 ml-1">{unit}</span>}
        </span>
        <button
          onClick={() => onChange(value + step)}
          disabled={disabled}
          className={`w-12 h-12 rounded-full font-black text-xl flex items-center justify-center transition-colors ${
            disabled ? 'bg-gray-200 text-white cursor-not-allowed' : 'bg-letusBlue text-white active:bg-blue-600'
          }`}
        >
          +
        </button>
      </div>
    </div>
  )
}

// 세트 진행 도트 — 목표 세트 수만큼의 원. 끝낸 세트는 채운 원, 아직 안 한 세트는 빈 원이고,
// 지금 하는 세트는 빈 원에 파란 테두리로 구분한다.
// 끝낸 세트의 도트만 누를 수 있다(onSelect). 지금 보고 있는 끝낸 세트는 바깥 고리로 표시한다.
// locked: 세트 정보를 수정하는 중에는 다른 세트로 이동하지 못하게 막는다.
function SetDots({ total, done, viewing = null, locked = false, onSelect }) {
  return (
    <div className="flex justify-center mt-3">
      <div
        role="group"
        aria-label={`${total}세트 중 ${done}세트 완료`}
        className="inline-flex flex-wrap justify-center items-center max-w-full px-2 py-1 rounded-2xl bg-white border border-gray-200 shadow-sm"
      >
        {Array.from({ length: total }, (_, i) => {
          const isDone = i < done
          const dotClass = `block w-3.5 h-3.5 rounded-full border-2 transition-all ${
            isDone ? 'bg-letusBlue border-letusBlue' : i === done ? 'border-letusBlue bg-transparent' : 'border-gray-300 bg-transparent'
          } ${viewing === i ? 'ring-2 ring-letusBlue/40 ring-offset-2' : ''}`
          // 점은 작게 보이지만 누르는 영역은 넉넉하게(약 30px) 잡는다
          return isDone ? (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => onSelect?.(i)}
              aria-label={`${i + 1}번째 세트 보기`}
              aria-pressed={viewing === i}
              className={`p-2 rounded-full ${locked ? 'cursor-not-allowed opacity-60' : 'active:bg-blue-50'}`}
            >
              <span className={dotClass} />
            </button>
          ) : (
            <span key={i} className="p-2">
              <span className={dotClass} />
            </span>
          )
        })}
      </div>
    </div>
  )
}

// 로그 배열을 linkedToNext 사슬 기준으로 묶는다 — 수퍼세트는 여러 운동이 한 그룹으로 묶여 세트 단위로 번갈아 진행된다.
function buildGroups(ids, logsSnapshot) {
  const groups = []
  let current = []
  ids.forEach(id => {
    current.push(id)
    const log = logsSnapshot.find(l => l.id === id)
    if (!log?.linkedToNext) {
      groups.push(current)
      current = []
    }
  })
  if (current.length) groups.push(current)
  return groups
}

// 그룹 안 운동들의 세트를 진행 순서대로 펼친다 — 공통 라운드는 운동끼리 번갈아, 세트 수가 남는 운동은 그 뒤에 혼자 이어서.
function buildFlatSteps(groupLogs) {
  const commonRounds = Math.min(...groupLogs.map(l => l.targetSets || 1))
  const steps = []
  for (let r = 0; r < commonRounds; r++) {
    groupLogs.forEach(l => steps.push({ logId: l.id, round: r }))
  }
  groupLogs.forEach(l => {
    const target = l.targetSets || 1
    for (let r = commonRounds; r < target; r++) {
      steps.push({ logId: l.id, round: r })
    }
  })
  return steps
}

export default function WorkoutSession() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const routineId = searchParams.get('routineId')
  const date = searchParams.get('date')
  const { logs, setLogs, routines, setRoutines, exercises: exerciseCatalog, skippedSupported, feelSupported } = useWorkoutLogs()
  const { settings } = useSettings() // 기본 휴식 시간·화면 꺼짐 방지·점진 과부하 자동 적용
  const dayKcal = useDayKcal(date)
  const daySeconds = useDayDuration(date)

  const routine = routines.find(r => r.id === routineId)

  // 세션 시작 시점의 운동 목록·그룹을 고정해서, 완료 처리로 목록이 바뀌어도 순서가 안 흔들리게 한다.
  // 목록에는 이미 끝낸 운동까지 전부 보여주고(완료된 건 선택 불가), 실제로 진행하는 건 시작 시점에 안 끝난 운동뿐이다.
  const [sessionIds] = useState(() => logs.filter(l => l.routineId === routineId && l.date === date).map(l => l.id))
  const [initiallyDone] = useState(() => new Set(logs.filter(l => l.routineId === routineId && l.date === date && l.isCompleted).map(l => l.id)))
  const [groups] = useState(() => buildGroups(sessionIds, logs))
  const allSessionLogs = logs.filter(l => l.routineId === routineId && l.date === date)
  const totalCount = allSessionLogs.length
  const doneCount = allSessionLogs.filter(l => l.isCompleted).length
  // 건너뛴 운동(한 세트도 안 하고 넘긴 것)의 기록 id. 기록의 skipped 표시로 저장돼서(lib/logStatus.js) 앱을 다시 열어도 유지되고,
  // 오늘 기록에는 "건너뜀"으로 남는다(미완료지만 "아직 할 운동"으로 세지 않는다).
  const skippedIds = new Set(allSessionLogs.filter(isSkipped).map(l => l.id))
  const [swapLog, setSwapLog] = useState(null) // 운동 바꾸기 시트가 열려 있으면 바꿀 기록
  // 오늘만 세트 수를 늘리거나 줄인 운동의 증감(기록 id → 계획 대비 ±n). 기록의 목표 세트(targetSets)는 계획 그대로 두고, 세션 안에서만 더하고 뺀다.
  // 그래서 점진 과부하는 "계획 N세트 중 몇 세트를 했나"로 그대로 판단하고(덜 하면 유지), 루틴·예정 기록의 세트 수는 바뀌지 않는다.
  const [setDelta, setSetDelta] = useState({})

  // 그룹(수퍼세트는 여러 운동이 한 그룹)이 모두 끝났는지 — 목록에서 선택을 막고, 다음에 할 그룹을 찾는 데 쓴다
  const isGroupDone = i => groups[i].every(id => skippedIds.has(id) || logs.find(l => l.id === id)?.isCompleted)
  // 현재 그룹 다음에 할 그룹: 뒤쪽을 먼저 보고, 없으면 앞쪽에 남은 것. 남은 게 없으면 -1.
  const findNextPendingGroup = from => {
    for (let k = 1; k < groups.length; k++) {
      const i = (from + k) % groups.length
      if (!isGroupDone(i)) return i
    }
    return -1
  }

  // 처음 시작할 그룹: 안 끝난 첫 그룹 (전부 끝났으면 0)
  const [groupIdx, setGroupIdx] = useState(() => Math.max(0, groups.findIndex((_, i) => groups[i].some(id => !initiallyDone.has(id) && !skippedIds.has(id)))))
  const hasPendingGroup = groups.some((_, i) => !isGroupDone(i))
  const currentGroupIds = (groups[groupIdx] || []).filter(id => !initiallyDone.has(id))
  const withDelta = l => (setDelta[l.id] ? { ...l, targetSets: Math.max(1, (l.targetSets || 1) + setDelta[l.id]) } : l)
  const groupLogs = currentGroupIds.map(id => logs.find(l => l.id === id)).filter(Boolean).map(withDelta)
  const flatSteps = groupLogs.length ? buildFlatSteps(groupLogs) : []

  // 'ready'(그룹 시작 전) → 'active'(세트 진행중) → 'rest'(휴식 — 수퍼세트 안에서는 건너뜀) → 'finished'
  const [subPhase, setSubPhase] = useState('ready')
  const [stepCursor, setStepCursor] = useState(0)
  const [performedByLog, setPerformedByLog] = useState({})
  // 임시 저장(lib/sessionDraft.js): 세트를 끝내거나 고칠 때마다 이 기기에 저장해 두고, 앱이 중간에 종료·새로고침됐을 때 이어서 할 수 있게 한다.
  // 이어서 할지 정하기 전(pendingDraft가 있는 동안)에는 기존 임시 저장을 덮어쓰지 않는다.
  const { user } = useAuth()
  const draftStorageKey = draftKey(user?.id, routineId, date)
  const [pendingDraft, setPendingDraft] = useState(() => {
    pruneOldDrafts()
    return loadDraft(draftStorageKey, logs)
  })
  const resumeRef = useRef(null)
  const applyResumeRef = useRef(null)
  const [setForm, setSetForm] = useState(null)
  const [setStartAt, setSetStartAt] = useState(null)
  const [pendingRestBefore, setPendingRestBefore] = useState(null)
  const [restTotal, setRestTotal] = useState(settings.defaultRestSeconds)
  const [restRemaining, setRestRemaining] = useState(settings.defaultRestSeconds)
  // 휴식 종료 시각(ms). 남은 시간은 이 값에서 계산한다 — 화면이 꺼지거나 탭이 백그라운드여도 시간이 정확하다.
  const [restEndAt, setRestEndAt] = useState(null)
  const [restNextAction, setRestNextAction] = useState(null)
  const [progressionNotes, setProgressionNotes] = useState([])
  // 한쪽씩 하는 운동의 좌→우 안내: 0 = 왼쪽 하는 중, 1 = 오른쪽 하는 중. 세트 하나가 끝나거나 새 세트·운동이 시작되면 0으로 돌아간다. 기록(횟수×무게 한 줄)에는 영향이 없다.
  const [sidePhase, setSidePhase] = useState(0)
  const [lastDoneId, setLastDoneId] = useState(null) // 방금 끝낸 운동(휴식 화면에서 체감 난이도를 묻는다) — 운동 하나의 마지막 세트를 끝낸 직후에만

  // 끝낸 세트 보기/수정: reviewIdx = 보고 있는 끝낸 세트(0부터, null이면 지금 하는 세트), editing = 수정 중, editForm = 수정 중인 값
  const [reviewIdx, setReviewIdx] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [stretchKind, setStretchKind] = useState(null) // 워밍업('warmup')·스트레칭('cooldown') 시트
  const reviewEnteredAtRef = useRef(null) // 끝낸 세트를 보기 시작한 시각 — 그동안은 현재 세트 소요 시간에서 빼 준다

  // 그룹이 바뀌면(다음 운동/수퍼세트로 넘어가면) 진행 상태를 전부 초기화
  useEffect(() => {
    setSubPhase('ready')
    setStepCursor(0)
    setPerformedByLog({})
    setSetForm(null)
    setPendingRestBefore(null)
    setReviewIdx(null)
    setEditing(false)
    setEditForm(null)
    reviewEnteredAtRef.current = null
    applyResumeRef.current?.() // 이어서 하기로 다른 그룹에 들어온 경우: 초기화한 뒤 임시 저장한 지점부터 다시 채운다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx])

  // 세트 기록이 바뀔 때마다 임시 저장한다(끝난 운동은 빼고, 남는 게 없으면 지움)
  useEffect(() => {
    if (pendingDraft) {
      // 이어서 할지 고르지 않고 새 운동을 시작했다면 옛 임시 저장은 버린 것으로 본다
      if (subPhase === 'active') {
        clearDraft(draftStorageKey)
        setPendingDraft(null)
      }
      return
    }
    const active = {}
    for (const [id, sets] of Object.entries(performedByLog)) {
      if (sets.length && !logs.find(l => l.id === id)?.isCompleted) active[id] = sets
    }
    saveDraft(draftStorageKey, active)
  }, [performedByLog, logs, pendingDraft, subPhase, draftStorageKey])

  // 휴식 카운트다운: 1초 타이머를 세는 대신 종료 시각과 현재 시각의 차이를 주기적으로 계산한다.
  // (setTimeout 방식은 폰 화면이 꺼지거나 앱이 백그라운드로 가면 느려지거나 멈춘다)
  useEffect(() => {
    if (subPhase !== 'rest' || restEndAt == null) return
    const tick = () => setRestRemaining(Math.max(0, Math.ceil((restEndAt - Date.now()) / 1000)))
    tick()
    const timer = setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [subPhase, restEndAt])

  useEffect(() => {
    if (subPhase === 'rest' && restRemaining <= 0) {
      // 시간이 다 돼서 끝난 경우에만 알린다("건너뛰기"는 사용자가 직접 누른 것이라 알리지 않음)
      notifyRestEnd({ vibrate: settings.restAlertVibrate, sound: settings.restAlertSound })
      finishRest()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subPhase, restRemaining])

  // 운동 중에는 화면이 저절로 꺼지지 않게 한다 (지원하는 브라우저에서만, 설정에서 끌 수 있음)
  useEffect(() => {
    if (!settings.keepAwake) return
    let lock = null
    let cancelled = false
    const acquire = async () => {
      try {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) lock.release().catch(() => {})
      } catch {
        // 배터리 절약 모드 등으로 거부될 수 있다 — 화면 유지가 안 될 뿐 운동 진행에는 영향 없음
      }
    }
    acquire()
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [settings.keepAwake])

  if (!routine || totalCount === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6">
        <div className="text-ui-body text-gray-400 font-bold">진행할 세션을 찾을 수 없습니다.</div>
        <button onClick={() => navigate(LOG_PATH)} className="w-full max-w-xl bg-letusBlue text-white text-ui-body font-bold py-4 rounded-2xl">
          캘린더로 돌아가기
        </button>
      </div>
    )
  }

  const currentStep = flatSteps[stepCursor]
  const currentLog = currentStep ? groupLogs.find(l => l.id === currentStep.logId) : null
  const memberIdx = currentLog ? groupLogs.findIndex(l => l.id === currentLog.id) : -1
  const isSuperset = groupLogs.length > 1

  const startStep = (stepIdx, restBefore) => {
    const step = flatSteps[stepIdx]
    const log = groupLogs.find(l => l.id === step.logId)
    setStepCursor(stepIdx)
    setPendingRestBefore(restBefore)
    setSetForm({ reps: log.targetReps || 0, weight: log.targetWeight || 0 })
    setSetStartAt(Date.now())
    setSidePhase(0)
    setReviewIdx(null)
    setEditing(false)
    setEditForm(null)
    reviewEnteredAtRef.current = null
    setSubPhase('active')
  }

  // ── 임시 저장한 세트 기록 이어서 하기 ─────────────────────────────
  // 이어서 할 그룹으로 이동(필요하면)한 뒤, 기록된 세트를 채우고 아직 안 한 첫 세트부터 시작한다.
  // 그룹이 바뀌면 위의 초기화 effect가 진행 상태를 비우므로, 그 뒤에 이 함수가 다시 채우도록 resumeRef에 담아 둔다.
  const applyResume = () => {
    const draft = resumeRef.current
    resumeRef.current = null
    if (!draft) return
    const idx = resumeStepIndex(flatSteps, draft.performedByLog)
    if (idx === -1) return
    startStep(idx, null)
    setPerformedByLog(draft.performedByLog)
  }
  applyResumeRef.current = applyResume
  const discardDraft = () => {
    clearDraft(draftStorageKey)
    setPendingDraft(null)
  }
  const resumeDraft = () => {
    if (!pendingDraft) return
    const ids = Object.keys(pendingDraft.performedByLog)
    const gi = groups.findIndex(g => g.some(id => ids.includes(id)))
    if (gi === -1) return discardDraft()
    resumeRef.current = pendingDraft
    setPendingDraft(null)
    if (gi === groupIdx) applyResume()
    else setGroupIdx(gi)
  }

  // ── 끝낸 세트 보기·수정 ─────────────────────────────────────────  // 이미 끝낸 세트의 기록은 performedByLog에 있고, 이 운동의 마지막 세트를 끝낼 때 한꺼번에 저장된다.
  // 그래서 여기서 고친 값이 그대로 저장·피로도·칼로리 계산에 쓰인다.
  const doneSets = currentLog ? performedByLog[currentLog.id] || [] : []
  const openFinishedSet = i => {
    if (editing || i >= doneSets.length) return
    if (reviewIdx === null) reviewEnteredAtRef.current = Date.now()
    setReviewIdx(i)
  }
  const backToCurrentSet = () => {
    // 끝낸 세트를 보고 있던 시간은 현재 세트가 걸린 시간에 들어가지 않게 시작 시각을 그만큼 늦춘다
    if (reviewEnteredAtRef.current) {
      const paused = Date.now() - reviewEnteredAtRef.current
      setSetStartAt(t => (t == null ? t : t + paused))
      reviewEnteredAtRef.current = null
    }
    setReviewIdx(null)
    setEditing(false)
    setEditForm(null)
  }
  const startEdit = () => {
    const s = doneSets[reviewIdx]
    if (!s) return
    setEditForm({ reps: s.reps, weight: s.weight })
    setEditing(true)
  }
  const cancelEdit = () => {
    setEditing(false)
    setEditForm(null)
  }
  const saveEdit = () => {
    if (!currentLog || !editForm) return
    setPerformedByLog(prev => ({
      ...prev,
      [currentLog.id]: (prev[currentLog.id] || []).map((s, i) => (i === reviewIdx ? { ...s, reps: editForm.reps, weight: editForm.weight } : s)),
    }))
    setEditing(false)
    setEditForm(null)
  }

  const startRest = (seconds, nextAction) => {
    setRestTotal(seconds)
    setRestRemaining(seconds)
    setRestEndAt(Date.now() + seconds * 1000)
    setRestNextAction(nextAction)
    setSubPhase('rest')
  }

  // 운동 하나를 끝내면 수행 능력을 평가해서(lib/progression.js, 이중 점진) 다음 목표(세트/횟수/무게)를 정한다.
  // 바뀐 목표는 루틴과, 이미 미리 만들어진 같은 운동의 앞으로 예정된 기록(2주치)에 같이 반영한다 — 루틴만 고치면 미리 만든 기록은 옛 목표 그대로라서.
  const planOf = log => routines.find(r => r.id === log.routineId)?.exercises.find(e => e.exercise === log.exercise)
  const metaOf = log => exerciseCatalog.find(e => e.name === log.exercise)
  // 한쪽씩 하는 운동(운동 리스트의 표시)은 횟수가 한쪽 기준이라 목표 문구에 "한쪽"을 붙인다
  const sideOf = name => (exerciseCatalog.find(e => e.name === name)?.unilateral ? '한쪽 ' : '')

  // 워밍업(운동 전)·스트레칭(운동 후) 시트: 열려 있는 종류와, 그 시트에 쓸 오늘 운동의 근육
  //  - 워밍업은 아직 안 한 운동의 근육, 스트레칭은 오늘 루틴 전체의 근육
  const musclesOf = ids => ids.map(id => logs.find(l => l.id === id)).filter(Boolean).flatMap(l => metaOf(l)?.muscles || [])
  const warmupMuscles = musclesOf(sessionIds.filter(id => !initiallyDone.has(id)))
  const cooldownMuscles = musclesOf(sessionIds)
  const ratingLog = lastDoneId ? logs.find(l => l.id === lastDoneId && l.isCompleted) ?? null : null // 휴식 화면에서 체감 난이도를 물을 운동
  const ratable = allSessionLogs.filter(l => l.isCompleted && !initiallyDone.has(l.id)) // 완료 화면에서 체감 난이도를 고를 수 있는 오늘 한 운동
  // 웜업 세트 제안(lib/warmupSets.js): 오늘 첫 복합관절 운동에만, 본 세트 무게 기준으로 가벼운 무게부터. 표시용이라 기록에는 넣지 않는다.
  const warmupId = warmupTargetId(sessionIds.map(id => logs.find(l => l.id === id)).filter(Boolean), metaOf)
  // 운동 메모(기구 세팅·자세 포인트): 운동 리스트의 메모를 시작 화면과 첫 세트 전 화면에 보여 준다
  const renderNote = log => {
    const note = metaOf(log)?.note
    if (!note) return null
    return (
      <div className="mt-2 rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-ui-caption leading-relaxed">
        <div className="font-bold text-orange-800">메모</div>
        <div className="whitespace-pre-wrap text-gray-700">{note}</div>
      </div>
    )
  }
  const renderWarmup = log => {
    if (log.id !== warmupId || log.isCompleted) return null
    const sets = warmupSets(log.targetWeight, { equipment: metaOf(log)?.equipment })
    if (!sets.length) return null
    return (
      <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-ui-caption leading-relaxed">
        <div className="font-bold text-letusBlue">웜업 세트 제안 · 본 세트 전에</div>
        <div className="font-bold text-gray-700">{warmupText(sets)} → 본 세트 {kgLabel(log.targetWeight)}</div>
        <div className="text-gray-400">참고용이에요. 기록에는 넣지 않아요. 몸 상태에 맞게 줄이거나 늘리세요.</div>
      </div>
    )
  }
  // 원판 계산기(lib/plateMath.js): 바벨 운동의 지금 입력한 무게를 한쪽에 끼울 원판으로 풀어 보여 준다(봉 20kg 기준).
  const renderPlates = weight => {
    const r = platesPerSide(weight)
    if (r.kind === 'invalid') return null
    return (
      <div className="px-1 text-ui-caption font-bold text-gray-500">
        {r.kind === 'light' && `빈 봉(${BAR_KG}kg)보다 가벼워요`}
        {r.kind === 'bar' && `빈 봉만 (${BAR_KG}kg)`}
        {r.kind === 'plates' && (
          <>
            <span className="text-gray-400">한쪽 원판 </span>
            {platesText(r.perSide)}kg
            <span className="font-normal text-gray-400"> · 봉 {BAR_KG}kg</span>
            {!r.exact && <span className="font-normal text-orange-600"> · 1.25kg 단위로 {r.shortKg}kg 모자라요</span>}
          </>
        )}
      </div>
    )
  }
  // 오늘 갱신한 개인 기록(lib/exerciseStats.js): 이전 기록보다 최고 무게·예상 1RM(맨몸은 최대 횟수)이 나아진 운동. 처음 하는 운동은 갱신이 아니다.
  const recordLabel = r => (r.kind === 'weight' ? `최고 무게 ${formatKg(r.value)} (이전 ${formatKg(r.prev)})` : r.kind === 'e1rm' ? `예상 1RM ${formatKg(r.value)} (이전 ${formatKg(r.prev)})` : `최대 횟수 ${r.value}회 (이전 ${r.prev}회)`)
  const todayRecords = ratable.map(l => ({ log: l, recs: newRecordsOf(logs, l) })).filter(x => x.recs.length)
  const skippedLogs = [...skippedIds].map(id => logs.find(l => l.id === id)).filter(Boolean) // 완료 화면에 알려 줄 건너뛴 운동
  // 수퍼세트에 든 운동인가(자기 자신이 "다음과 묶기"이거나 바로 앞 운동이 묶기) — 세트 사이 간격에 짝 운동 시간이 끼므로 휴식 판단에서 뺀다
  const inSuperset = log => {
    const day = logs.filter(l => l.routineId === log.routineId && l.date === log.date)
    const i = day.findIndex(l => l.id === log.id)
    return !!log.linkedToNext || (i > 0 && !!day[i - 1].linkedToNext)
  }
  // revert: 체감 난이도를 나중에 골라 다시 평가할 때, 앞서 올려 둔 목표를 되돌려야 하면 유지여도 목표를 다시 쓴다
  const applyProgression = (log, performedSets, fatigue, { revert = false } = {}) => {
    if (!log.routineId) return
    const stored = logs.find(l => l.id === log.id) ?? log // 오늘만 바꾼 세트 수가 아니라 계획한 세트 수(기록의 목표)로 평가한다
    const result = evaluateSession({ log: { ...stored, feel: log.feel, performedSets, fatigue }, plan: planOf(log), prevLogs: findPrevLogs(logs, log), meta: metaOf(log), skipRest: inSuperset(log) })
    if (!result) return
    const note = { exercise: log.exercise, verdict: result.verdict, label: result.label, reason: result.reason, next: result.next, restAdjust: result.restAdjust ?? null }
    setProgressionNotes(prev => (prev.some(n => n.exercise === log.exercise) ? prev.map(n => (n.exercise === log.exercise ? note : n)) : [...prev, note]))
    if (result.restAdjust) pushRest(log, result.restAdjust.to, false) // 계획 휴식 보정(목표와 별개)
    if (result.verdict === 'hold' && !revert) return // 목표를 그대로 두는 경우는 바꿀 게 없다

    pushTargets(log, result.next, false)
  }

  // 체감 난이도(쉬웠어요/적당해요/힘들었어요) — 운동을 끝낸 뒤 한 번 눌러 고른다. 같은 걸 다시 누르면 해제.
  // 운동을 끝내는 순간 이미 규칙대로 다음 목표를 정해 두었으므로, 고르면 그 값을 넣어 다시 평가해서 목표를 고쳐 쓴다(자동 적용을 켠 경우).
  const rateFeel = log => feel => {
    const cur = logs.find(l => l.id === log.id)
    if (!cur) return
    const value = cur.feel === feel ? null : feel
    const prevVerdict = progressionNotes.find(n => n.exercise === cur.exercise)?.verdict
    setLogs(prev => prev.map(l => (l.id === cur.id ? { ...l, feel: value } : l)))
    if (settings.autoProgression) applyProgression({ ...cur, feel: value }, cur.performedSets, cur.fatigue, { revert: !!prevVerdict && prevVerdict !== 'hold' })
  }
  const renderFeel = log => (
    <div className="flex gap-2" role="group" aria-label={`${log.exercise} 체감 난이도`}>
      {FEEL_KEYS.map(k => (
        <button
          key={k}
          type="button"
          aria-pressed={log.feel === k}
          onClick={() => rateFeel(log)(k)}
          className={`flex-1 min-h-[40px] rounded-xl border text-ui-body font-bold ${log.feel === k ? FEEL_ON[k] : 'bg-white border-gray-200 text-gray-600 active:bg-gray-50'}`}
        >
          {FEEL_LABELS[k]}
        </button>
      ))}
    </div>
  )

  // 새 목표를 루틴과, 같은 운동의 앞으로 예정된 기록에 반영한다. includeSelf면 이 기록(오늘 것)에도 반영.
  const pushTargets = (log, next, includeSelf) => {
    setRoutines(prev =>
      prev.map(r =>
        r.id === log.routineId ? { ...r, exercises: r.exercises.map(ex => (ex.exercise === log.exercise ? applyNextToPlan(ex, next) : ex)) } : r,
      ),
    )
    setLogs(prev =>
      prev.map(l =>
        (includeSelf && l.id === log.id) || (l.routineId === log.routineId && l.exercise === log.exercise && !l.isCompleted && l.date > log.date)
          ? { ...l, targetSets: next.sets, targetReps: next.reps, targetWeight: next.weight }
          : l,
      ),
    )
  }
  // 계획 휴식(초)을 루틴과, 같은 운동의 앞으로 예정된 기록에 반영한다. includeSelf면 이 기록(오늘 것)에도 반영.
  const pushRest = (log, to, includeSelf) => {
    setRoutines(prev =>
      prev.map(r => (r.id === log.routineId ? { ...r, exercises: r.exercises.map(ex => (ex.exercise === log.exercise ? { ...ex, restSeconds: to } : ex)) } : r)),
    )
    setLogs(prev =>
      prev.map(l =>
        (includeSelf && l.id === log.id) || (l.routineId === log.routineId && l.exercise === log.exercise && !l.isCompleted && l.date > log.date) ? { ...l, restSeconds: to } : l,
      ),
    )
  }
  const sameTarget = (log, next) =>
    (log.targetSets || 0) === next.sets && (Number(log.targetReps) || 0) === next.reps && (Number(log.targetWeight) || 0) === next.weight

  // 시작 화면용: 이 운동의 지난번 기록과 그때의 평가 (처음 하는 운동이면 null)
  const lastSessionInfo = log => {
    const prev = findPrevLog(logs, log)
    if (!prev) return null
    return { prev, result: evaluateSession({ log: prev, plan: planOf(log), prevLogs: findPrevLogs(logs, prev), meta: metaOf(log), skipRest: inSuperset(prev) }) }
  }

  // 한쪽씩 하는 운동: 왼쪽을 끝내고 오른쪽으로(쉬지 않는다). 진동은 휴식 종료 진동 설정을 따른다.
  const finishFirstSide = () => {
    setSidePhase(1)
    if (settings.restAlertVibrate) {
      try {
        navigator.vibrate?.(60)
      } catch {
        /* 진동을 못 쓰는 기기는 무시 */
      }
    }
  }

  const completeSet = () => {
    if (!setForm || !currentLog || !currentStep) return
    unlockAudio() // 휴식 종료 소리를 낼 수 있게, 화면을 누른 이 시점에 오디오를 열어 둔다
    setSidePhase(0)
    const endedAt = Date.now()
    const durationSeconds = Math.max(1, Math.round((endedAt - setStartAt) / 1000))
    const newSet = { reps: setForm.reps, weight: setForm.weight, durationSeconds, restBeforeSeconds: pendingRestBefore, startedAt: setStartAt, endedAt }
    const updatedForLog = [...(performedByLog[currentLog.id] || []), newSet]
    const nextPerformed = { ...performedByLog, [currentLog.id]: updatedForLog }
    setPerformedByLog(nextPerformed)

    // 이 운동의 세트가 이걸로 끝인지 확인 (flatSteps에서 이 운동이 다시 나오는지)
    const isLastStepForLog = !flatSteps.slice(stepCursor + 1).some(s => s.logId === currentLog.id)
    setLastDoneId(isLastStepForLog ? currentLog.id : null)
    if (isLastStepForLog) {
      const recentMax = getRecentMaxWeight(logs, currentLog.exercise)
      const fatigue = estimateExerciseFatigue(updatedForLog, recentMax)
      setLogs(prev => prev.map(l => (l.id === currentLog.id ? { ...l, performedSets: updatedForLog, fatigue, isCompleted: true } : l)))
      if (settings.autoProgression) applyProgression(currentLog, updatedForLog, fatigue) // 끄면 목표를 자동으로 바꾸지 않는다(시작 화면의 추천을 보고 직접 적용)
    }

    const restSeconds = currentLog.restSeconds || settings.defaultRestSeconds
    const nextStepIdx = findNextLiveStep(stepCursor + 1) // 건너뛴·이미 마친 운동의 단계는 뛰어넘는다

    if (nextStepIdx >= flatSteps.length) {
      // 그룹(수퍼세트 포함) 전체 종료
      // 다음에 할 그룹은 목록에서 직접 고른 순서와 무관하게, 남은 것 중 현재 다음(뒤 → 앞 순)으로 정한다
      const nextIdx = findNextPendingGroup(groupIdx)
      if (nextIdx === -1) {
        setSubPhase('finished')
      } else {
        startRest(restSeconds, { type: 'nextGroup', groupIdx: nextIdx })
      }
      return
    }

    const nextStep = flatSteps[nextStepIdx]
    if (nextStep.round !== currentStep.round) {
      // 라운드 경계 — 방금 끝낸 운동 기준으로 휴식
      startRest(restSeconds, { type: 'nextStep', stepIdx: nextStepIdx })
    } else {
      // 같은 라운드 안에서 다음 운동으로 — 수퍼세트는 휴식 없이 바로 이어간다
      startStep(nextStepIdx, 0)
    }
  }

  // ── 오늘만 세트 늘리기·줄이기 ─────────────────────────────────────────
  // 지금 하는 운동의 세트 수를 오늘 세션에서만 ±1 한다(루틴·기록의 목표는 그대로). 줄이기는 이 세트를 포함해 2세트 이상 남았을 때만 된다(1세트 남았으면 "이 운동 건너뛰기"가 마치기).
  // 세트 수가 바뀌면 진행 순서(flatSteps)가 달라지므로(수퍼세트는 번갈아 순서), 지금까지 한 세트 수 기준으로 지금 단계를 다시 찾는다.
  const changeSetCount = d => {
    if (!currentLog || reviewIdx !== null) return
    const id = currentLog.id
    const stored = logs.find(l => l.id === id)
    const nextTotal = (currentLog.targetSets || 1) + d
    if (!stored || nextTotal < doneSets.length + 1 || nextTotal > MAX_SETS) return
    setSetDelta(prev => ({ ...prev, [id]: nextTotal - (stored.targetSets || 1) }))
    const newSteps = buildFlatSteps(groupLogs.map(l => (l.id === id ? { ...l, targetSets: nextTotal } : l)))
    const idx = newSteps.findIndex(s => s.round >= (performedByLog[s.logId]?.length || 0) && !isDeadStep(s))
    if (idx === -1 || idx === stepCursor) return
    setStepCursor(idx)
    if (newSteps[idx].logId !== id) {
      // 수퍼세트에서 순서가 바뀌어 다른 운동 차례가 된 경우: 그 운동의 목표로 입력칸을 다시 채운다
      const l = groupLogs.find(g => g.id === newSteps[idx].logId)
      setSetForm({ reps: l.targetReps || 0, weight: l.targetWeight || 0 })
      setSetStartAt(Date.now())
      setPendingRestBefore(null)
      setSidePhase(0)
    }
  }

  // ── 다음에 할 단계 찾기 / 운동 건너뛰기 ─────────────────────────────
  // 아직 할 단계 중 다음 것: 건너뛴 운동, 또는 세트를 덜 하고 마친 운동의 남은 단계는 뛰어넘는다. 더 없으면 flatSteps.length.
  const isDeadStep = (s, extraDeadId) => s.logId === extraDeadId || skippedIds.has(s.logId) || !!logs.find(l => l.id === s.logId)?.isCompleted
  const findNextLiveStep = (from, extraDeadId = null) => {
    for (let i = from; i < flatSteps.length; i++) if (!isDeadStep(flatSteps[i], extraDeadId)) return i
    return flatSteps.length
  }

  // 건너뜀 칼럼이 DB에 없으면(SQL 미실행) 건너뜀이 저장되지 않아 앱을 다시 열면 예정으로 돌아온다 — 확인창에 알린다
  const skipSqlNote = () => (skippedSupported === false ? '\n(※ 이 데이터베이스에는 건너뜀 칼럼이 없어서 앱을 다시 열면 예정으로 돌아와요. supabase/log_skipped.sql 실행이 필요해요.)' : '')

  // 이 운동 건너뛰기: 한 세트라도 했으면 한 만큼만 저장하고 마친다(남은 세트는 안 함). 한 세트도 안 했으면 기록 없이 오늘 세션에서만 뺀다
  // (오늘 기록은 미완료로 남아 나중에 할 수 있다). 수퍼세트면 짝 운동은 계속 이어간다.
  const skipExercise = () => {
    if (!currentLog || reviewIdx !== null) return
    const sets = performedByLog[currentLog.id] || []
    const ask = sets.length
      ? `이 운동을 여기서 마칠까요?\n지금까지 한 ${sets.length}세트만 기록하고, 남은 세트는 건너뛰어요.`
      : `이 운동을 건너뛸까요?\n기록 없이 다음 운동으로 넘어가요. 오늘 기록에 '건너뜀'으로 남고, 기록 화면에서 다시 할 수 있어요.${skipSqlNote()}`
    if (!confirm(ask)) return
    setLastDoneId(sets.length ? currentLog.id : null)
    if (sets.length) {
      const recentMax = getRecentMaxWeight(logs, currentLog.exercise)
      const fatigue = estimateExerciseFatigue(sets, recentMax)
      setLogs(prev => prev.map(l => (l.id === currentLog.id ? { ...l, performedSets: sets, fatigue, isCompleted: true } : l)))
      if (settings.autoProgression) applyProgression(currentLog, sets, fatigue) // 계획한 세트를 다 못 했으면 규칙이 "유지"로 판단한다
    } else {
      setLogs(prev => prev.map(l => (l.id === currentLog.id ? { ...l, skipped: true } : l)))
    }
    const nextIdx = findNextLiveStep(stepCursor + 1, currentLog.id)
    if (nextIdx < flatSteps.length) return startStep(nextIdx, null) // 쉬지 않고 바로 다음 단계(수퍼세트 짝 운동)
    const nextGroup = findNextPendingGroup(groupIdx)
    if (nextGroup === -1) setSubPhase('finished')
    else setGroupIdx(nextGroup)
  }

  // ── 운동 바꾸기(lib/exerciseSwap.js) ───────────────────────────────
  // 세트·횟수·휴식 목표는 그대로, 운동명과 무게만 바뀐다. 무게는 새 운동의 지난 기록에서 가져오고 없으면 0(운동 화면에서 직접 입력).
  // "오늘만"이면 오늘 기록만, "루틴에도"면 루틴과 앞으로 예정된 같은 운동 기록도 바꾼다(이미 한 기록은 그대로).
  const handleSwapPick = (exercise, scope) => {
    const log = swapLog
    if (!log) return
    const weight = lastWeightFor(exercise.name, logs) ?? 0
    const toRoutine = scope === 'routine' && !!log.routineId
    setLogs(prev => swapLogs(prev, log, exercise.name, weight, toRoutine))
    if (toRoutine) setRoutines(prev => swapRoutine(prev, log, exercise.name, weight))
    // 세트 진행 화면에서 바꿨다면 입력칸을 새 운동의 목표로 다시 채운다
    if (subPhase === 'active' && currentLog?.id === log.id) {
      setSetForm({ reps: log.targetReps || 0, weight })
      setSetStartAt(Date.now())
    }
    setSidePhase(0)
    setSwapLog(null)
  }

  // ── 루틴 종료 ─────────────────────────────────────────────────────
  // 오늘 아직 안 한 운동을 모두 "건너뜀"으로 표시하고 마친다. 한 운동은 그대로 남고, 건너뜀은 기록 화면에서 다시 할 수 있다.
  // (건너뜀은 "아직 할 운동"에 세지 않으므로, 종료한 뒤에는 메인 메뉴 카드·기록 화면의 시작하기에서 이 루틴이 더 이상 운동 중으로 보이지 않는다.)
  const endRoutine = () => {
    const pending = allSessionLogs.filter(l => !l.isCompleted && !l.skipped)
    const draftNote = pendingDraft ? '\n임시 저장된 세트 기록은 버려져요.' : ''
    const ask = pending.length
      ? `루틴을 종료할까요?\n아직 안 한 운동 ${pending.length}개는 '건너뜀'으로 기록에 남아요. (기록 화면에서 다시 할 수 있어요.)${draftNote}${skipSqlNote()}`
      : `루틴을 종료할까요?${draftNote}`
    if (!confirm(ask)) return
    if (pendingDraft) {
      clearDraft(draftStorageKey)
      setPendingDraft(null)
    }
    setLogs(prev => prev.map(l => (l.routineId === routineId && l.date === date && !l.isCompleted && !l.skipped ? { ...l, skipped: true } : l)))
    setSubPhase('finished')
  }

  const finishRest = () => {
    const elapsed = restTotal - restRemaining
    if (restNextAction?.type === 'nextStep') {
      startStep(restNextAction.stepIdx, elapsed)
    } else if (restNextAction?.type === 'nextGroup') {
      setGroupIdx(restNextAction.groupIdx)
    }
  }

  const adjustRest = delta => {
    setRestTotal(t => t + delta)
    setRestRemaining(r => Math.max(0, r + delta))
    setRestEndAt(t => t + delta * 1000)
  }

  // 종료(X): 세트 진행·휴식 중에 누르면 그 운동의 진행 내용이 사라지므로 한 번 확인한다.
  // (이미 끝낸 운동은 저장되어 있다 — 운동 하나의 마지막 세트를 끝낼 때 기록된다)
  const handleExit = () => {
    if ((subPhase === 'active' || subPhase === 'rest') && !confirm('운동을 종료할까요?\n진행 중인 운동의 세트 기록은 이 기기에 임시 저장돼서, 다시 들어오면 이어서 할 수 있어요.\n(이미 끝낸 운동은 저장되어 있습니다.)')) return
    navigate(LOG_PATH)
  }

  const mm = String(Math.floor(restRemaining / 60)).padStart(2, '0')
  const ss = String(restRemaining % 60).padStart(2, '0')

  // 휴식 화면에 보여줄 "다음" 정보 — 다음 운동으로 넘어가는 휴식인지, 같은 그룹 안의 다음 라운드인지
  let restPreview = null
  if (restNextAction?.type === 'nextStep') {
    const s = flatSteps[restNextAction.stepIdx]
    const l = groupLogs.find(x => x.id === s.logId)
    restPreview = { exercise: l.exercise, round: s.round, targetSets: l.targetSets, isNewGroup: false }
  } else if (restNextAction?.type === 'nextGroup') {
    const nextGroupLogs = (groups[restNextAction.groupIdx] || []).filter(id => !initiallyDone.has(id)).map(id => logs.find(x => x.id === id)).filter(Boolean)
    if (nextGroupLogs.length) {
      restPreview = { exercise: nextGroupLogs[0].exercise, round: 0, targetSets: nextGroupLogs[0].targetSets, isNewGroup: true }
    }
  }

  // 오늘 운동 목록(왼쪽 칸) - 시작 전에는 눌러서 시작할 운동을 고르고, 진행 중에는 현재 위치만 보여 준다. 이미 끝낸 운동은 선택할 수 없다. 수퍼세트는 한 묶음이다.
  const groupList = (
          <div className="min-h-0 flex flex-col">
            <div className="flex items-baseline justify-between mb-2 px-1">
              <span className="text-ui-body font-black text-gray-800">오늘 운동 목록</span>
              <span className="text-ui-caption font-bold text-gray-400">
                {totalCount}개 중 {doneCount}개 완료
              </span>
            </div>
            <div className="space-y-2 overflow-y-auto md:max-h-[calc(100vh-220px)]">
              {groups.map((ids, gi) => {
                const rows = ids.map(id => logs.find(l => l.id === id)).filter(Boolean)
                const groupDone = isGroupDone(gi)
                const groupSkipped = groupDone && ids.some(id => skippedIds.has(id)) // 건너뛴 운동이 든 그룹 — 눌러서 다시 할 수 있다
                const isSelectedGroup = gi === groupIdx && !groupDone
                return (
                  <button
                    key={ids[0]}
                    type="button"
                    disabled={subPhase !== 'ready' || (groupDone && !groupSkipped)}
                    onClick={() => {
                      if (groupSkipped) setLogs(prev => prev.map(l => (ids.includes(l.id) && !l.isCompleted ? { ...l, skipped: false } : l)))
                      setGroupIdx(gi)
                    }}
                    aria-pressed={isSelectedGroup}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                      groupSkipped ? 'bg-orange-50 border-orange-200 hover:bg-orange-100' : groupDone ? 'bg-gray-50 border-gray-100 cursor-not-allowed opacity-60' : isSelectedGroup ? 'bg-blue-50 border-letusBlue' : 'bg-white border-gray-200 hover:bg-gray-50 disabled:hover:bg-white'
                    }`}
                  >
                    {rows.length > 1 && (
                      <div className="flex items-center gap-1 text-ui-caption font-black text-letusBlue mb-1.5">
                        <Link2 className="w-3.5 h-3.5" />
                        수퍼세트
                      </div>
                    )}
                    <div className="space-y-2">
                      {rows.map(l => (
                        <div key={l.id} className="flex items-center gap-3">
                          <span
                            className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-ui-caption font-black ${
                              l.isCompleted ? 'bg-green-100 text-green-600' : skippedIds.has(l.id) ? 'bg-orange-100 text-orange-600' : isSelectedGroup ? 'bg-letusBlue text-white' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {l.isCompleted ? <Check className="w-3.5 h-3.5" /> : skippedIds.has(l.id) ? <SkipForward className="w-3.5 h-3.5" /> : sessionIds.indexOf(l.id) + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className={`text-ui-body font-bold truncate ${l.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>{l.exercise}</div>
                            <div className="text-ui-caption text-gray-400">
                              {l.targetSets}세트 × {sideOf(l.exercise)}{l.targetReps}회 × {l.targetWeight ? `${l.targetWeight}kg` : '맨몸'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {(groupDone || isSelectedGroup) && (
                      <div className={`mt-1.5 text-right text-ui-caption font-bold ${groupSkipped ? 'text-orange-600' : groupDone ? 'text-green-600' : 'text-letusBlue'}`}>
                        {groupSkipped ? (subPhase === 'ready' ? '건너뜀 · 누르면 다시 하기' : '건너뜀') : groupDone ? '완료' : subPhase === 'ready' ? '선택됨' : '진행 중'}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
  )

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-ui-title font-bold text-gray-800 truncate">{routine.name}</h2>
          <div className="text-ui-caption font-bold text-gray-400 mt-0.5">
            {doneCount}/{totalCount} 완료
          </div>
        </div>
        <button
          onClick={handleExit}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-ui-body font-bold text-gray-600 hover:bg-gray-50 transition-colors"
          title="종료"
          aria-label="운동 종료"
        >
          <X className="w-3.5 h-3.5" />
          종료
        </button>
      </div>

      {/* 2단: 왼쪽은 오늘 운동 목록(진행 상황), 오른쪽은 지금 하는 일(시작 전 준비 → 세트 → 휴식 → 완료) */}
      <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)] items-start">
        <aside className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:sticky md:top-4">{groupList}</aside>
        <main className="bg-white rounded-xl border border-gray-100 shadow-sm min-h-[560px] flex flex-col">
      {subPhase === 'ready' && (
        <div className="flex-1 flex flex-col max-w-xl w-full mx-auto px-5 pt-5 pb-6 gap-4 min-h-0">
          {/* 앱이 중간에 종료·새로고침돼서 임시 저장된 세트 기록이 있으면 이어서 할지 묻는다 */}
          {pendingDraft && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 space-y-2">
              <div className="text-ui-body font-bold text-orange-800">하던 운동 기록이 있어요</div>
              <div className="text-ui-caption text-orange-700 leading-relaxed">{draftSummary(pendingDraft, logs).map(d => `${d.exercise} ${d.sets}세트 완료`).join(' · ')}</div>
              <div className="flex gap-2">
                <button type="button" onClick={resumeDraft} className="flex-1 min-h-[40px] rounded-lg bg-letusBlue text-white text-ui-body font-bold active:bg-blue-600">
                  이어서 하기
                </button>
                <button type="button" onClick={discardDraft} className="px-4 min-h-[40px] rounded-lg border border-orange-300 text-orange-700 text-ui-body font-bold active:bg-orange-100">
                  버리기
                </button>
              </div>
            </div>
          )}
          {hasPendingGroup && groupLogs.length > 0 ? (
            <>
              {/* 시작할 운동 — 위 목록에서 고른 운동 */}
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3.5 shadow-sm">
                <div className="text-ui-caption font-bold text-gray-400 mb-1.5">시작할 운동{isSuperset ? ' · 🔗 수퍼세트' : ''}</div>
                <div className="space-y-2">
                  {groupLogs.map(l => {
                    const last = lastSessionInfo(l)
                    const style = last?.result ? VERDICT_STYLE[last.result.verdict] : null
                    return (
                      <div key={l.id}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-2xl font-black text-gray-800">{l.exercise}</div>
                          {/* 이미 끝낸 운동(건너뛴 짝 운동을 다시 살린 수퍼세트에서 남아 있을 수 있다)은 바꿀 수 없다 */}
                          {!l.isCompleted && (
                            <button
                              type="button"
                              onClick={() => setSwapLog(l)}
                              className="shrink-0 flex items-center gap-1 px-3 min-h-[36px] rounded-full border border-gray-200 bg-white text-ui-caption font-bold text-gray-700 active:bg-gray-100"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                              바꾸기
                            </button>
                          )}
                        </div>
                        <div className="text-ui-body font-bold text-gray-400">
                          {l.targetSets}세트 × {sideOf(l.exercise)}{l.targetReps}회 × {kgLabel(l.targetWeight)} 목표
                        </div>
                        {/* 쓰는 근육(신체도) + 유튜브 자세 영상 검색 */}
                        <ExerciseGuide compact name={l.exercise} muscles={metaOf(l)?.muscles || []} />
                        {renderNote(l)}
                        {renderWarmup(l)}
                        {/* 지난번 수행 → 평가 → 위 목표가 나온 이유 */}
                        <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-ui-caption leading-relaxed">
                          {last ? (
                            <>
                              <div className="text-gray-400">
                                지난번 {last.prev.date.slice(5).replace('-', '/')} · {summarizePerformed(last.prev.performedSets)} · 피로도 {last.prev.fatigue ?? '-'}
                              </div>
                              {last.result && (
                                <div className={`font-bold ${style.color}`}>
                                  {style.icon} {last.result.label}
                                  <span className="font-normal text-gray-500"> — {last.result.reason}</span>
                                </div>
                              )}
                              {/* 오늘 목표가 이 평가와 다르면(이 기능 이전 기록, 직접 고친 목표 등) 추천 목표를 보여주고, 누르면 적용한다 */}
                              {last.result && l.routineId && !sameTarget(l, last.result.next) && (
                                <div className="mt-1.5 flex items-center justify-between gap-2">
                                  <span className="font-bold text-gray-700">
                                    추천 {last.result.next.sets}세트 × {sideOf(l.exercise)}{last.result.next.reps}회 × {kgLabel(last.result.next.weight)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => pushTargets(l, last.result.next, true)}
                                    className="shrink-0 px-3 min-h-[32px] rounded-full bg-letusBlue text-white font-bold active:bg-blue-600"
                                  >
                                    적용
                                  </button>
                                </div>
                              )}
                              {/* 계획 휴식 보정 추천: 자동 적용을 꺼 두었거나 아직 반영되지 않은 경우(오늘 휴식이 보정 전 값 그대로일 때)만 */}
                              {last.result?.restAdjust && l.routineId && Number(l.restSeconds) === last.result.restAdjust.from && (
                                <div className="mt-1.5 flex items-center justify-between gap-2">
                                  <span className="font-bold text-gray-700">
                                    추천 휴식 {last.result.restAdjust.to}초 <span className="font-normal text-gray-400">(지금 {last.result.restAdjust.from}초)</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => pushRest(l, last.result.restAdjust.to, true)}
                                    className="shrink-0 px-3 min-h-[32px] rounded-full bg-letusBlue text-white font-bold active:bg-blue-600"
                                  >
                                    적용
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-gray-400">처음 하는 운동이에요. 10회를 2~3회 남기고 할 수 있는 가벼운 무게에서 시작해 보세요. 운동 결과를 보고 앱이 다음 무게를 정해요.</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* 운동 전 워밍업 — 오늘 하는 부위에 맞는 동적 동작(타이머 포함) */}
              <button
                type="button"
                onClick={() => setStretchKind('warmup')}
                className="w-full shrink-0 flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-gray-200 bg-white text-ui-body font-bold text-gray-700 active:bg-gray-50"
              >
                <Flame className="w-4 h-4 text-orange-500" />
                운동 전 워밍업 · 약 {planMinutes(stretchPlan('warmup', warmupMuscles))}분
              </button>
              <button
                onClick={() => startStep(0, null)}
                className="w-full h-16 shrink-0 bg-letusBlue text-white font-black text-ui-title rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-[0.98] transition-all"
              >
                시작하기
              </button>
              {/* 남은 운동을 건너뜀으로 하고 루틴을 마친다 */}
              <button type="button" onClick={endRoutine} className="mx-auto shrink-0 flex items-center gap-1.5 px-4 py-3 text-ui-body font-bold text-gray-400 underline underline-offset-2">
                <Flag className="w-4 h-4" />
                루틴 종료
              </button>
            </>
          ) : (
            <div className="text-center space-y-3 py-2">
              <div className="text-ui-body font-bold text-gray-500">오늘 운동을 모두 완료했어요.</div>
              <button onClick={() => navigate(LOG_PATH)} className="w-full bg-letusBlue text-white font-black text-ui-title py-4 rounded-2xl">
                캘린더로 돌아가기
              </button>
            </div>
          )}
        </div>
      )}

      {subPhase === 'active' && currentLog && setForm && (
        <div className="flex-1 flex flex-col max-w-xl w-full mx-auto px-6 pt-6 pb-8">
          {isSuperset && (
            <div className="text-ui-caption font-black text-letusBlue text-center mb-1">
              🔗 수퍼세트 {memberIdx + 1}/{groupLogs.length}
            </div>
          )}
          <div className="text-2xl font-black text-gray-800 text-center mt-1">{currentLog.exercise}</div>
          {sideOf(currentLog.exercise) && (reviewIdx === null ? (
            <div className="mt-2 flex flex-col items-center gap-1">
              <div className="flex items-center gap-2" role="group" aria-label="왼쪽·오른쪽 진행">
                {['왼쪽', '오른쪽'].map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={sidePhase === i}
                    onClick={() => setSidePhase(i)}
                    className={`min-h-[32px] px-4 rounded-full border text-ui-body font-bold ${sidePhase === i ? 'bg-orange-50 border-orange-400 text-orange-700' : sidePhase > i ? 'bg-white border-gray-200 text-gray-400' : 'bg-white border-gray-200 text-gray-500'}`}
                  >
                    {sidePhase > i ? `${label} ✓` : label}
                  </button>
                ))}
              </div>
              <span className="text-ui-caption font-bold text-orange-700">한쪽씩 · 왼쪽·오른쪽을 모두 하면 1세트</span>
            </div>
          ) : (
            <div className="mt-1.5 text-center">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 text-ui-caption font-bold">한쪽씩 · 왼쪽·오른쪽을 모두 하면 1세트</span>
            </div>
          ))}
          {reviewIdx === null && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {doneSets.length === 0 && (
                <button
                  type="button"
                  onClick={() => setSwapLog(currentLog)}
                  className="inline-flex items-center gap-1 px-3 min-h-[32px] rounded-full bg-gray-100 text-gray-600 text-ui-caption font-bold active:bg-gray-200"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  운동 바꾸기
                </button>
              )}
              {(currentLog.targetSets || 1) - doneSets.length >= 2 && (
                <button type="button" onClick={() => changeSetCount(-1)} className="inline-flex items-center gap-1 px-3 min-h-[32px] rounded-full bg-gray-100 text-gray-600 text-ui-caption font-bold active:bg-gray-200">
                  <Minus className="w-3.5 h-3.5" />
                  세트 줄이기
                </button>
              )}
              {(currentLog.targetSets || 1) < MAX_SETS && (
                <button type="button" onClick={() => changeSetCount(1)} className="inline-flex items-center gap-1 px-3 min-h-[32px] rounded-full bg-gray-100 text-gray-600 text-ui-caption font-bold active:bg-gray-200">
                  <Plus className="w-3.5 h-3.5" />
                  세트 추가
                </button>
              )}
            </div>
          )}
          {doneSets.length === 0 && reviewIdx === null && renderNote(currentLog)}
          {doneSets.length === 0 && reviewIdx === null && renderWarmup(currentLog)}
          <SetDots total={currentLog.targetSets || 1} done={doneSets.length} viewing={reviewIdx} locked={editing} onSelect={openFinishedSet} />
          {/* 끝낸 세트를 보고 있을 때만 안내가 나온다. 화면이 출렁이지 않게 자리는 항상 잡아 둔다 */}
          <div className={`h-5 mt-3 mb-4 text-center text-ui-caption font-bold ${editing ? 'text-letusBlue' : 'text-gray-400'}`}>
            {reviewIdx !== null && `${reviewIdx + 1}번째 세트 · ${editing ? '수정 중' : '완료한 기록'}`}
          </div>

          {(() => {
            // 끝낸 세트를 보는 중이면 그 세트의 기록을(수정 중이면 수정 값을), 아니면 지금 하는 세트의 값을 보여준다
            const reviewing = reviewIdx !== null
            const shown = reviewing ? (editing ? editForm : doneSets[reviewIdx]) : setForm
            const change = field => v => (reviewing ? setEditForm(f => ({ ...f, [field]: v })) : setSetForm(f => ({ ...f, [field]: v })))
            return (
              <div className="space-y-4">
                <StepperCard label={sideOf(currentLog.exercise) ? '반복 (한쪽)' : '반복'} value={shown.reps} step={1} onChange={change('reps')} disabled={reviewing && !editing} />
                <StepperCard label="무게" value={shown.weight} step={WEIGHT_STEP_KG} unit="kg" onChange={change('weight')} disabled={reviewing && !editing} />
                {metaOf(currentLog)?.equipment === '바벨' && renderPlates(shown.weight)}
              </div>
            )
          })()}

          {reviewIdx === null ? (
            <>
              <button
                onClick={sideOf(currentLog.exercise) && sidePhase === 0 ? finishFirstSide : completeSet}
                className="w-full h-16 bg-letusBlue text-white font-black text-ui-title rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-[0.98] transition-all mt-8"
              >
                {sideOf(currentLog.exercise) && sidePhase === 0 ? '왼쪽 끝 · 오른쪽으로' : '세트 완료'}
              </button>
              {sideOf(currentLog.exercise) && sidePhase === 0 && (
                <button type="button" onClick={completeSet} className="mx-auto mt-2 px-4 py-2 text-ui-caption font-bold text-gray-500 underline underline-offset-2">
                  좌우 안내 없이 바로 세트 완료
                </button>
              )}
              <button type="button" onClick={skipExercise} className="mx-auto mt-3 flex items-center gap-1.5 px-4 py-3 text-ui-body font-bold text-gray-400 underline underline-offset-2">
                <SkipForward className="w-4 h-4" />
                이 운동 건너뛰기
              </button>
            </>
          ) : editing ? (
            <>
              <button onClick={saveEdit} className="w-full h-16 bg-letusBlue text-white font-black text-ui-title rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-[0.98] transition-all mt-8">
                수정 완료
              </button>
              <button onClick={cancelEdit} className="mx-auto mt-2 px-4 py-3 text-ui-body font-bold text-gray-400 underline underline-offset-2">
                수정 취소
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="w-full h-16 bg-gray-800 text-white font-black text-ui-title rounded-2xl shadow-lg shadow-gray-900/10 active:scale-[0.98] transition-all mt-8">
                수정하기
              </button>
              <button onClick={backToCurrentSet} className="mx-auto mt-2 px-4 py-3 text-ui-body font-bold text-letusBlue underline underline-offset-2">
                현재 세트로 돌아가기
              </button>
            </>
          )}
        </div>
      )}

      {subPhase === 'rest' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="text-ui-caption font-bold text-gray-400 tracking-wide">{restPreview?.isNewGroup ? '휴식 중' : '세트 휴식'}</div>
          <div className="text-6xl font-black text-letusBlue tabular-nums">
            {mm}:{ss}
          </div>
          <div className="flex gap-3">
            <button onClick={() => adjustRest(-15)} className="px-5 py-2.5 rounded-xl border border-gray-300 text-ui-body font-bold text-gray-600 hover:bg-gray-50">
              −15초
            </button>
            <button onClick={() => adjustRest(15)} className="px-5 py-2.5 rounded-xl border border-gray-300 text-ui-body font-bold text-gray-600 hover:bg-gray-50">
              +15초
            </button>
          </div>
          <button onClick={finishRest} className="text-letusBlue font-bold text-ui-body underline underline-offset-2 mt-2 px-4 py-3">
            건너뛰기
          </button>
          {ratingLog && (
            <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white px-4 py-3 space-y-2">
              <div className="text-ui-caption font-bold text-gray-500">방금 한 {ratingLog.exercise}, 어땠어요?</div>
              {renderFeel(ratingLog)}
              <div className="text-ui-caption text-gray-400">고르면 다음 목표를 정할 때 참고해요. 안 골라도 돼요.</div>
            </div>
          )}
          {restPreview && (
            <div className="text-ui-caption text-gray-400 mt-6">
              {restPreview.isNewGroup
                ? `다음 운동: ${restPreview.exercise}`
                : `다음: ${restPreview.exercise} ${restPreview.round + 1}/${restPreview.targetSets}세트`}
            </div>
          )}
        </div>
      )}

      {subPhase === 'finished' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center">
          <div className="text-5xl">{doneCount > 0 ? '🎉' : '👋'}</div>
          <div className="text-xl font-black text-gray-800">{doneCount > 0 ? '오늘 루틴 완료!' : '루틴을 종료했어요'}</div>
          <div className="text-ui-caption text-gray-400">{routine.name}</div>

          {/* 총 운동 시간 — 세트 시작·종료 시각을 합친 실측값 (사이 휴식 포함, 15분 넘게 쉰 구간은 제외) */}
          {daySeconds != null && (
            <div className="w-full max-w-xl bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mt-2">
              <div className="text-ui-caption font-bold text-letusBlue">오늘 총 운동 시간</div>
              <div className="text-2xl font-black text-letusBlue mt-0.5">{formatDuration(daySeconds)}</div>
            </div>
          )}

          {/* 오늘 소모 칼로리 추정 — 시간(휴식 포함)과 강도를 반영한 추정치라서 "약"으로 표시한다 */}
          {dayKcal.kcal != null && (
            <div className="w-full max-w-xl bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 mt-2">
              <div className="text-ui-caption font-bold text-orange-700">오늘 소모 칼로리 (추정)</div>
              <div className="text-2xl font-black text-orange-600 mt-0.5">약 {dayKcal.kcal.toLocaleString()} kcal</div>
              <div className="text-ui-caption text-orange-700/70 mt-1">웨이트 소모량은 개인차가 커서 오차가 있을 수 있어요.</div>
            </div>
          )}
          {dayKcal.needsWeight && <div className="text-ui-caption font-bold text-gray-400">신체 기록에 몸무게를 입력하면 소모 칼로리가 표시됩니다.</div>}

          {skippedLogs.length > 0 && (
            <div className="w-full max-w-xl rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-left mt-2">
              <div className="text-ui-caption font-bold text-orange-800">건너뛴 운동</div>
              <div className="text-ui-body font-bold text-orange-700">{skippedLogs.map(l => l.exercise).join(' · ')}</div>
              <div className="text-ui-caption text-orange-700/80 leading-relaxed">오늘 기록에 건너뜀으로 남아 있어요. 기록 화면에서 다시 할 수 있어요.</div>
            </div>
          )}

          {todayRecords.length > 0 && (
            <div className="w-full max-w-xl rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-left mt-2">
              <div className="text-ui-caption font-bold text-emerald-700">🏆 개인 기록 갱신</div>
              {todayRecords.map(({ log, recs }) => (
                <div key={log.id} className="mt-1">
                  <div className="text-ui-body font-bold text-gray-800">{log.exercise}</div>
                  {recs.map(r => (
                    <div key={r.kind} className="text-ui-caption text-emerald-700">
                      {recordLabel(r)}
                    </div>
                  ))}
                </div>
              ))}
              <div className="mt-1 text-ui-caption text-emerald-700/70">예상 1RM은 추정치예요.</div>
            </div>
          )}

          {ratable.length > 0 && (
            <div className="w-full max-w-xl mt-4 text-left space-y-2">
              <div className="text-ui-caption font-bold text-gray-500">
                운동은 어땠어요? <span className="font-normal text-gray-400">· 고르면 다음 목표에 참고해요</span>
              </div>
              {ratable.map(l => (
                <div key={l.id} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 space-y-1.5">
                  <div className="text-ui-body font-bold text-gray-700">{l.exercise}</div>
                  {renderFeel(l)}
                </div>
              ))}
              {feelSupported === false && <div className="text-ui-caption text-orange-600 leading-relaxed">※ 이 데이터베이스에는 체감 난이도 칼럼이 없어서 앱을 다시 열면 사라져요. supabase/log_feel.sql 실행이 필요해요.</div>}
            </div>
          )}

          {progressionNotes.length > 0 && (
            <div className="w-full max-w-xl space-y-1.5 mt-4 text-left">
              {progressionNotes.map((n, i) => (
                <div key={i} className="text-ui-caption font-bold bg-white rounded-lg px-3 py-2.5 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">{n.exercise}</span>
                    <span className={VERDICT_STYLE[n.verdict].color}>
                      {VERDICT_STYLE[n.verdict].icon} {n.label}
                    </span>
                  </div>
                  <div className="mt-0.5 font-normal text-gray-400">{n.reason}</div>
                  <div className="mt-0.5 text-gray-700">
                    다음 목표 {n.next.sets}세트 × {sideOf(n.exercise)}{n.next.reps}회 × {kgLabel(n.next.weight)}
                  </div>
                  {n.restAdjust && (
                    <div className="mt-0.5 text-gray-700">
                      휴식 {n.restAdjust.from}초 → {n.restAdjust.to}초 <span className="font-normal text-gray-400">· {n.restAdjust.reason}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 운동 후 스트레칭 — 오늘 쓴 부위에 맞는 정적 스트레칭(타이머 포함) */}
          <button
            type="button"
            onClick={() => setStretchKind('cooldown')}
            className="mt-4 w-full max-w-xl flex items-center justify-center gap-2 min-h-[48px] rounded-2xl border border-gray-200 bg-white text-ui-body font-bold text-gray-700 active:bg-gray-50"
          >
            <PersonStanding className="w-4 h-4 text-letusBlue" />
            운동 후 스트레칭 · 약 {planMinutes(stretchPlan('cooldown', cooldownMuscles))}분
          </button>

          <button
            onClick={() => navigate(LOG_PATH)}
            className="mt-2 w-full max-w-xl bg-letusBlue text-white font-black text-ui-title py-4 rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-colors"
          >
            캘린더로 돌아가기
          </button>
        </div>
      )}

        </main>
      </div>

      {swapLog && (
        <SwapExerciseModal
          log={swapLog}
          catalog={exerciseCatalog}
          excludeNames={sessionExcludeNames(logs, routineId, date)}
          routineNames={routineExerciseNames(routines, routineId)}
          myEquipment={settings.myEquipment || []}
          canApplyToRoutine={!!swapLog.routineId && !!planOf(swapLog)}
          weightFor={name => lastWeightFor(name, logs)}
          onPick={handleSwapPick}
          onClose={() => setSwapLog(null)}
        />
      )}
      {stretchKind && <StretchModal kind={stretchKind} muscles={stretchKind === 'warmup' ? warmupMuscles : cooldownMuscles} onClose={() => setStretchKind(null)} />}
    </div>
  )
}
