import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { summarizePoints, workoutDaysKey } from '../lib/points.js'
import { petErrorMessage } from '../lib/pet.js'
import { todayStr } from '../lib/bodyGoal.js'
import { useAuth } from './AuthContext.jsx'
import { useWorkoutLogs } from './WorkoutLogsContext.jsx'

// 운동 포인트 상태(웹앱·PWA 공용). 지급은 서버 함수 claim_points()가 한다(supabase/points.sql) — 앱은 "받아 와 줘"라고 부르고 내역을 읽기만 한다.
// supabase/points.sql을 아직 실행하지 않았으면(테이블·함수 없음) supported가 false가 되고 포인트 화면은 숨겨진다.
const PointsContext = createContext(null)

// 테이블·함수가 없을 때의 오류(PostgREST·Postgres)
const isMissing = e => !!e && ['PGRST202', 'PGRST205', '42P01', '42883'].includes(e.code)

export function PointsProvider({ children }) {
  const { user } = useAuth()
  const { logs } = useWorkoutLogs()
  const [events, setEvents] = useState([])
  const [pets, setPets] = useState([]) // 키우는 펫과 도감(최신순)
  const [balance, setBalance] = useState(0) // 서버가 합친 잔액(내역이 1000행을 넘어도 정확)
  const [supported, setSupported] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const lastClaimRef = useRef(0)

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('point_events').select('kind, ref, points, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      if (isMissing(error)) setSupported(false)
      else console.error('포인트 내역 불러오기 실패', error)
      return
    }
    setEvents(data ?? [])
    const bal = await supabase.rpc('point_balance')
    if (!bal.error && Number.isFinite(Number(bal.data))) setBalance(Number(bal.data))
  }, [])

  const reloadPets = useCallback(async () => {
    const { data, error } = await supabase.from('pets').select('id, species, xp, created_at, hatched_at, completed_at').order('created_at', { ascending: false }).limit(200)
    if (error) {
      if (isMissing(error)) setSupported(false)
      else console.error('펫 불러오기 실패', error)
      return
    }
    setPets(data ?? [])
  }, [])

  // 서버에 지급을 요청하고(운동 기록이 저장돼 있어야 반영됨), 새로 받은 포인트가 있으면 내역을 다시 읽는다
  const claim = useCallback(async () => {
    lastClaimRef.current = Date.now()
    const { data, error } = await supabase.rpc('claim_points')
    if (error) {
      if (isMissing(error)) setSupported(false)
      else console.error('포인트 지급 요청 실패', error)
      return 0
    }
    if (Number(data) > 0) await reload()
    return Number(data) || 0
  }, [reload])

  // 앱을 열 때: 지급 요청 → 내역 읽기
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      await claim()
      await reload()
      await reloadPets()
      if (!cancelled) setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, claim, reload, reloadPets])

  // 운동한 날이 바뀌면(운동을 끝냈거나 기록을 고쳤을 때) 기록이 서버에 저장될 시간을 두고 두 번 요청한다. 저장이 늦어져도 다음 요청이나 앱을 다시 열 때 받는다.
  const daysKey = useMemo(() => workoutDaysKey(logs, todayStr()), [logs])
  const firstKeyRef = useRef(true)
  useEffect(() => {
    if (firstKeyRef.current) {
      firstKeyRef.current = false
      return
    }
    const t1 = setTimeout(claim, 3000)
    const t2 = setTimeout(claim, 15000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [daysKey, claim])

  // 앱이 다시 보일 때(1분에 한 번까지)
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && Date.now() - lastClaimRef.current > 60000 && claim()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [claim])

  // 펫 동작(서버 함수가 가격·단계를 검증한다). 성공하면 null, 실패하면 화면에 보일 문구를 돌려준다.
  const runPet = useCallback(
    async (fn, args) => {
      const { error } = await supabase.rpc(fn, args)
      await Promise.all([reload(), reloadPets()]) // 실패해도 서버 기준으로 다시 맞춘다
      return error ? petErrorMessage(error) : null
    },
    [reload, reloadPets],
  )
  const adoptPet = useCallback(() => runPet('pet_adopt'), [runPet])
  const feedPet = useCallback(amount => runPet('pet_feed', { p_amount: amount }), [runPet])

  const today = todayStr()
  const summary = useMemo(() => ({ ...summarizePoints(events, today), balance }), [events, today, balance])
  return <PointsContext.Provider value={{ supported, loaded, events, summary, pets, adoptPet, feedPet }}>{children}</PointsContext.Provider>
}

export function usePoints() {
  const ctx = useContext(PointsContext)
  if (!ctx) throw new Error('usePoints must be used within PointsProvider')
  return ctx
}
