import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { X, Check, Link2 } from 'lucide-react'
import { useWorkoutLogs } from '../../context/WorkoutLogsContext.jsx'
import { getRecentMaxWeight, estimateExerciseFatigue } from '../../lib/workoutMetrics.js'

const DEFAULT_REST_SECONDS = 90
// 세션이 끝나거나 종료할 때 돌아갈 곳 — 모바일 기록 화면 (데스크탑 경로 /workout/log로 가면 헤더 없는 데스크탑 화면이 열린다)
const LOG_PATH = '/mobile/log'

function StepperCard({ label, value, step, unit, onChange }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
      <div className="text-m-caption font-bold text-gray-400 mb-2">{label}</div>
      <div className="flex items-center justify-between">
        <button
          onClick={() => onChange(Math.max(0, value - step))}
          className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 font-black text-xl flex items-center justify-center active:bg-gray-200 transition-colors"
        >
          −
        </button>
        <span className="text-2xl font-black text-gray-800 tabular-nums">
          {value}
          {unit && <span className="text-m-body font-bold text-gray-400 ml-1">{unit}</span>}
        </span>
        <button
          onClick={() => onChange(value + step)}
          className="w-12 h-12 rounded-full bg-letusBlue text-white font-black text-xl flex items-center justify-center active:bg-blue-600 transition-colors"
        >
          +
        </button>
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
  const { logs, setLogs, routines, setRoutines } = useWorkoutLogs()

  const routine = routines.find(r => r.id === routineId)

  // 세션 시작 시점의 운동 목록·그룹을 고정해서, 완료 처리로 목록이 바뀌어도 순서가 안 흔들리게 한다.
  // 목록에는 이미 끝낸 운동까지 전부 보여주고(완료된 건 선택 불가), 실제로 진행하는 건 시작 시점에 안 끝난 운동뿐이다.
  const [sessionIds] = useState(() => logs.filter(l => l.routineId === routineId && l.date === date).map(l => l.id))
  const [initiallyDone] = useState(() => new Set(logs.filter(l => l.routineId === routineId && l.date === date && l.isCompleted).map(l => l.id)))
  const [groups] = useState(() => buildGroups(sessionIds, logs))
  const allSessionLogs = logs.filter(l => l.routineId === routineId && l.date === date)
  const totalCount = allSessionLogs.length
  const doneCount = allSessionLogs.filter(l => l.isCompleted).length

  // 그룹(수퍼세트는 여러 운동이 한 그룹)이 모두 끝났는지 — 목록에서 선택을 막고, 다음에 할 그룹을 찾는 데 쓴다
  const isGroupDone = i => groups[i].every(id => logs.find(l => l.id === id)?.isCompleted)
  // 현재 그룹 다음에 할 그룹: 뒤쪽을 먼저 보고, 없으면 앞쪽에 남은 것. 남은 게 없으면 -1.
  const findNextPendingGroup = from => {
    for (let k = 1; k < groups.length; k++) {
      const i = (from + k) % groups.length
      if (!isGroupDone(i)) return i
    }
    return -1
  }

  // 처음 시작할 그룹: 안 끝난 첫 그룹 (전부 끝났으면 0)
  const [groupIdx, setGroupIdx] = useState(() => Math.max(0, groups.findIndex((_, i) => groups[i].some(id => !initiallyDone.has(id)))))
  const hasPendingGroup = groups.some((_, i) => !isGroupDone(i))
  const currentGroupIds = (groups[groupIdx] || []).filter(id => !initiallyDone.has(id))
  const groupLogs = currentGroupIds.map(id => logs.find(l => l.id === id)).filter(Boolean)
  const flatSteps = groupLogs.length ? buildFlatSteps(groupLogs) : []

  // 'ready'(그룹 시작 전) → 'active'(세트 진행중) → 'rest'(휴식 — 수퍼세트 안에서는 건너뜀) → 'finished'
  const [subPhase, setSubPhase] = useState('ready')
  const [stepCursor, setStepCursor] = useState(0)
  const [performedByLog, setPerformedByLog] = useState({})
  const [setForm, setSetForm] = useState(null)
  const [setStartAt, setSetStartAt] = useState(null)
  const [pendingRestBefore, setPendingRestBefore] = useState(null)
  const [restTotal, setRestTotal] = useState(DEFAULT_REST_SECONDS)
  const [restRemaining, setRestRemaining] = useState(DEFAULT_REST_SECONDS)
  // 휴식 종료 시각(ms). 남은 시간은 이 값에서 계산한다 — 화면이 꺼지거나 탭이 백그라운드여도 시간이 정확하다.
  const [restEndAt, setRestEndAt] = useState(null)
  const [restNextAction, setRestNextAction] = useState(null)
  const [progressionNotes, setProgressionNotes] = useState([])

  // 그룹이 바뀌면(다음 운동/수퍼세트로 넘어가면) 진행 상태를 전부 초기화
  useEffect(() => {
    setSubPhase('ready')
    setStepCursor(0)
    setPerformedByLog({})
    setSetForm(null)
    setPendingRestBefore(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx])

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
    if (subPhase === 'rest' && restRemaining <= 0) finishRest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subPhase, restRemaining])

  // 운동 중에는 화면이 저절로 꺼지지 않게 한다 (지원하는 브라우저에서만)
  useEffect(() => {
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
  }, [])

  if (!routine || totalCount === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 bg-letusBg">
        <div className="text-m-body text-gray-400 font-bold">진행할 세션을 찾을 수 없습니다.</div>
        <button onClick={() => navigate(LOG_PATH)} className="w-full max-w-sm bg-letusBlue text-white text-m-body font-bold py-4 rounded-2xl">
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
    setSubPhase('active')
  }

  const startRest = (seconds, nextAction) => {
    setRestTotal(seconds)
    setRestRemaining(seconds)
    setRestEndAt(Date.now() + seconds * 1000)
    setRestNextAction(nextAction)
    setSubPhase('rest')
  }

  // 목표 세트를 전부 목표치 이상으로 채웠고 피로도가 낮음~보통(1-3)이면 다음 주기 루틴을 올리고,
  // 아니면 그대로 유지한다 — 체중 운동(목표 무게 0)은 무게 대신 반복 횟수를 올린다.
  const WEIGHT_INCREMENT = 2.5
  const applyProgression = (log, performedSets, fatigue) => {
    if (!log.routineId) return
    const metTarget = performedSets.every(s => s.reps >= (log.targetReps || 0) && s.weight >= (log.targetWeight || 0))
    const shouldProgress = metTarget && fatigue <= 3
    if (!shouldProgress) {
      setProgressionNotes(prev => [...prev, { exercise: log.exercise, progressed: false }])
      return
    }

    const isBodyweight = (log.targetWeight || 0) === 0
    setRoutines(prev =>
      prev.map(r =>
        r.id === log.routineId
          ? {
              ...r,
              exercises: r.exercises.map(ex =>
                ex.exercise === log.exercise
                  ? isBodyweight
                    ? { ...ex, reps: (Number(ex.reps) || 0) + 1 }
                    : { ...ex, weight: (Number(ex.weight) || 0) + WEIGHT_INCREMENT }
                  : ex,
              ),
            }
          : r,
      ),
    )
    setProgressionNotes(prev => [
      ...prev,
      isBodyweight ? { exercise: log.exercise, progressed: true, kind: 'reps', delta: 1 } : { exercise: log.exercise, progressed: true, kind: 'weight', delta: WEIGHT_INCREMENT },
    ])
  }

  const completeSet = () => {
    if (!setForm || !currentLog || !currentStep) return
    const durationSeconds = Math.max(1, Math.round((Date.now() - setStartAt) / 1000))
    const newSet = { reps: setForm.reps, weight: setForm.weight, durationSeconds, restBeforeSeconds: pendingRestBefore }
    const updatedForLog = [...(performedByLog[currentLog.id] || []), newSet]
    const nextPerformed = { ...performedByLog, [currentLog.id]: updatedForLog }
    setPerformedByLog(nextPerformed)

    // 이 운동의 세트가 이걸로 끝인지 확인 (flatSteps에서 이 운동이 다시 나오는지)
    const isLastStepForLog = !flatSteps.slice(stepCursor + 1).some(s => s.logId === currentLog.id)
    if (isLastStepForLog) {
      const recentMax = getRecentMaxWeight(logs, currentLog.exercise)
      const fatigue = estimateExerciseFatigue(updatedForLog, recentMax)
      setLogs(prev => prev.map(l => (l.id === currentLog.id ? { ...l, performedSets: updatedForLog, fatigue, isCompleted: true } : l)))
      applyProgression(currentLog, updatedForLog, fatigue)
    }

    const restSeconds = currentLog.restSeconds || DEFAULT_REST_SECONDS
    const nextStepIdx = stepCursor + 1

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
    if ((subPhase === 'active' || subPhase === 'rest') && !confirm('운동을 종료할까요?\n진행 중인 운동의 세트 기록은 저장되지 않습니다.\n(이미 끝낸 운동은 저장되어 있습니다.)')) return
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

  return (
    <div className="min-h-screen flex flex-col bg-letusBg">
      <div className="relative flex flex-col items-center pt-7 pb-4 px-6 shrink-0">
        <button
          onClick={handleExit}
          className="absolute top-5 right-4 w-11 h-11 flex items-center justify-center text-gray-400 active:text-gray-600 active:bg-gray-100 rounded-full transition-colors"
          title="종료"
          aria-label="운동 종료"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="text-m-body font-black text-gray-800">{routine.name}</div>
        <div className="text-m-caption font-bold text-gray-400 mt-1">
          {doneCount}/{totalCount} 완료
        </div>
      </div>

      {subPhase === 'ready' && (
        <div className="flex-1 flex flex-col max-w-sm w-full mx-auto px-5 pb-6 gap-4 min-h-0">
          {/* 오늘 운동 전체 목록 — 누르면 시작할 운동이 바뀐다. 이미 끝낸 운동은 선택할 수 없다. 수퍼세트는 한 묶음으로 선택된다. */}
          <div className="min-h-0 flex flex-col">
            <div className="flex items-baseline justify-between mb-2 px-1">
              <span className="text-m-body font-black text-gray-800">오늘 운동 목록</span>
              <span className="text-m-caption font-bold text-gray-400">
                {totalCount}개 중 {doneCount}개 완료
              </span>
            </div>
            <div className="space-y-2 overflow-y-auto max-h-[42vh]">
              {groups.map((ids, gi) => {
                const rows = ids.map(id => logs.find(l => l.id === id)).filter(Boolean)
                const groupDone = isGroupDone(gi)
                const isSelectedGroup = gi === groupIdx && !groupDone
                return (
                  <button
                    key={ids[0]}
                    type="button"
                    disabled={groupDone}
                    onClick={() => setGroupIdx(gi)}
                    aria-pressed={isSelectedGroup}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                      groupDone ? 'bg-gray-50 border-gray-100 cursor-not-allowed opacity-60' : isSelectedGroup ? 'bg-blue-50 border-letusBlue' : 'bg-white border-gray-200 active:bg-gray-50'
                    }`}
                  >
                    {rows.length > 1 && (
                      <div className="flex items-center gap-1 text-m-caption font-black text-letusBlue mb-1.5">
                        <Link2 className="w-3.5 h-3.5" />
                        수퍼세트
                      </div>
                    )}
                    <div className="space-y-2">
                      {rows.map(l => (
                        <div key={l.id} className="flex items-center gap-3">
                          <span
                            className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-m-caption font-black ${
                              l.isCompleted ? 'bg-green-100 text-green-600' : isSelectedGroup ? 'bg-letusBlue text-white' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {l.isCompleted ? <Check className="w-3.5 h-3.5" /> : sessionIds.indexOf(l.id) + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className={`text-m-body font-bold truncate ${l.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>{l.exercise}</div>
                            <div className="text-m-caption text-gray-400">
                              {l.targetSets}세트 × {l.targetReps}회 × {l.targetWeight ? `${l.targetWeight}kg` : '맨몸'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {(groupDone || isSelectedGroup) && (
                      <div className={`mt-1.5 text-right text-m-caption font-bold ${groupDone ? 'text-green-600' : 'text-letusBlue'}`}>{groupDone ? '완료' : '선택됨'}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {hasPendingGroup && groupLogs.length > 0 ? (
            <>
              {/* 시작할 운동 — 위 목록에서 고른 운동 */}
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3.5 shadow-sm">
                <div className="text-m-caption font-bold text-gray-400 mb-1.5">시작할 운동{isSuperset ? ' · 🔗 수퍼세트' : ''}</div>
                <div className="space-y-2">
                  {groupLogs.map(l => (
                    <div key={l.id}>
                      <div className="text-2xl font-black text-gray-800">{l.exercise}</div>
                      <div className="text-m-body font-bold text-gray-400">
                        {l.targetSets}세트 × {l.targetReps}회 × {l.targetWeight ? `${l.targetWeight}kg` : '맨몸'} 목표
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => startStep(0, null)}
                className="w-full h-16 shrink-0 bg-letusBlue text-white font-black text-m-title rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-[0.98] transition-all"
              >
                시작하기
              </button>
            </>
          ) : (
            <div className="text-center space-y-3 py-2">
              <div className="text-m-body font-bold text-gray-500">오늘 운동을 모두 완료했어요.</div>
              <button onClick={() => navigate(LOG_PATH)} className="w-full bg-letusBlue text-white font-black text-m-title py-4 rounded-2xl">
                캘린더로 돌아가기
              </button>
            </div>
          )}
        </div>
      )}

      {subPhase === 'active' && currentLog && setForm && (
        <div className="flex-1 flex flex-col max-w-sm w-full mx-auto px-6 pb-8">
          {isSuperset && (
            <div className="text-m-caption font-black text-letusBlue text-center mb-1">
              🔗 수퍼세트 {memberIdx + 1}/{groupLogs.length}
            </div>
          )}
          <div className="text-m-caption font-bold text-gray-400 text-center mb-1">
            {currentStep.round + 1}/{currentLog.targetSets} 세트
          </div>
          <div className="text-2xl font-black text-gray-800 text-center mt-1 mb-8">{currentLog.exercise}</div>

          <div className="space-y-4">
            <StepperCard label="반복" value={setForm.reps} step={1} onChange={v => setSetForm(f => ({ ...f, reps: v }))} />
            <StepperCard label="무게" value={setForm.weight} step={2.5} unit="kg" onChange={v => setSetForm(f => ({ ...f, weight: v }))} />
          </div>

          <button
            onClick={completeSet}
            className="w-full h-16 bg-letusBlue text-white font-black text-m-title rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-[0.98] transition-all mt-8"
          >
            세트 완료
          </button>
        </div>
      )}

      {subPhase === 'rest' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="text-m-caption font-bold text-gray-400 tracking-wide">{restPreview?.isNewGroup ? '휴식 중' : '세트 휴식'}</div>
          <div className="text-6xl font-black text-letusBlue tabular-nums">
            {mm}:{ss}
          </div>
          <div className="flex gap-3">
            <button onClick={() => adjustRest(-15)} className="px-5 py-2.5 rounded-xl border border-gray-300 text-m-body font-bold text-gray-600 hover:bg-gray-50">
              −15초
            </button>
            <button onClick={() => adjustRest(15)} className="px-5 py-2.5 rounded-xl border border-gray-300 text-m-body font-bold text-gray-600 hover:bg-gray-50">
              +15초
            </button>
          </div>
          <button onClick={finishRest} className="text-letusBlue font-bold text-m-body underline underline-offset-2 mt-2 px-4 py-3">
            건너뛰기
          </button>
          {restPreview && (
            <div className="text-m-caption text-gray-400 mt-6">
              {restPreview.isNewGroup
                ? `다음 운동: ${restPreview.exercise}`
                : `다음: ${restPreview.exercise} ${restPreview.round + 1}/${restPreview.targetSets}세트`}
            </div>
          )}
        </div>
      )}

      {subPhase === 'finished' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="text-5xl">🎉</div>
          <div className="text-xl font-black text-gray-800">오늘 루틴 완료!</div>
          <div className="text-m-caption text-gray-400">{routine.name}</div>

          {progressionNotes.length > 0 && (
            <div className="w-full max-w-sm space-y-1.5 mt-4 text-left">
              {progressionNotes.map((n, i) => (
                <div key={i} className="flex items-center justify-between text-m-caption font-bold bg-white rounded-lg px-3 py-2.5 border border-gray-100">
                  <span className="text-gray-700">{n.exercise}</span>
                  <span className={n.progressed ? 'text-letusBlue' : 'text-gray-400'}>
                    {n.progressed ? (n.kind === 'reps' ? `다음엔 +${n.delta}회 ↑` : `다음엔 +${n.delta}kg ↑`) : '다음엔 동일 유지'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => navigate(LOG_PATH)}
            className="mt-6 w-full max-w-sm bg-letusBlue text-white font-black text-m-title py-4 rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-colors"
          >
            캘린더로 돌아가기
          </button>
        </div>
      )}
    </div>
  )
}
