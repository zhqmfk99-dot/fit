import { useCallback, useMemo, useState } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { deloadAdvice, isSnoozed, snoozeUntil } from '../lib/deload.js'
import { todayStr } from '../lib/bodyGoal.js'

const KEY = 'fit-deload-snooze' // 이 기기에서 "숨기기"를 누른 뒤 숨김이 끝나는 날짜(YYYY-MM-DD)

const readSnooze = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null // 저장소를 못 쓰는 환경이면 숨기기가 이 화면을 보는 동안만 유지된다
  }
}

// 회복 주간 제안 + 숨기기. 계산은 lib/deload.js(웹앱·PWA 공용).
export function useDeloadAdvice() {
  const { logs } = useWorkoutLogs()
  const today = todayStr()
  const advice = useMemo(() => deloadAdvice(logs, today), [logs, today])
  const [until, setUntil] = useState(readSnooze)
  const snooze = useCallback(() => {
    const v = snoozeUntil(today)
    setUntil(v)
    try {
      localStorage.setItem(KEY, v)
    } catch {
      /* 저장 못 해도 화면에서는 숨겨진다 */
    }
  }, [today])
  return { advice, hidden: isSnoozed(until, today), snooze }
}