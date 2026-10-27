import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from './AuthContext.jsx'
import { EQUIPMENT_OPTIONS } from '../lib/muscleMap.js'

// 앱 설정 — 계정(profiles.settings)에 저장해서 기기를 바꿔도 같게 한다. (supabase/user_settings.sql)
// SQL을 아직 실행하지 않았으면(칼럼이 없으면) 이 기기(localStorage)에만 저장한다. 기기 저장본은 항상 캐시로도 쓴다.
export const SETTING_LIMITS = { restMin: 30, restMax: 300, restStep: 15 }
const SAVE_DELAY_MS = 600
export const LAST_THEME_KEY = 'fit-last-theme'
export const DEFAULT_SETTINGS = {
  theme: 'system', // 'system' | 'light' | 'dark'
  defaultRestSeconds: 90, // 루틴에 휴식을 안 적었을 때 쓰는 세트 간 휴식
  keepAwake: true, // 운동 중 화면 꺼짐 방지
  autoProgression: true, // 운동을 끝내면 다음 목표(세트·횟수·무게)를 루틴에 자동 반영
  aiUseHistory: true, // AI 루틴 만들기: 내 운동 기록 참고
  aiUseBody: false, // AI 루틴 만들기: 체형 정보 전송 (건강 정보라 기본 끔)
  myEquipment: [], // 내 운동기구(쓸 수 있는 기구) — AI 루틴 만들기의 "사용할 장비"에 자동 선택된다. 비면 전체. 맨몸은 기구가 필요 없어 항상 포함이라 저장하지 않는다.
}

// 저장된 값을 믿지 않고 항목마다 형식·범위를 맞춘다 (모르는 키는 버린다)
export function sanitizeSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const bool = (v, d) => (typeof v === 'boolean' ? v : d)
  const rest = Number(r.defaultRestSeconds)
  return {
    theme: ['system', 'light', 'dark'].includes(r.theme) ? r.theme : DEFAULT_SETTINGS.theme,
    defaultRestSeconds: Number.isFinite(rest) ? Math.min(SETTING_LIMITS.restMax, Math.max(SETTING_LIMITS.restMin, Math.round(rest))) : DEFAULT_SETTINGS.defaultRestSeconds,
    keepAwake: bool(r.keepAwake, DEFAULT_SETTINGS.keepAwake),
    autoProgression: bool(r.autoProgression, DEFAULT_SETTINGS.autoProgression),
    aiUseHistory: bool(r.aiUseHistory, DEFAULT_SETTINGS.aiUseHistory),
    aiUseBody: bool(r.aiUseBody, DEFAULT_SETTINGS.aiUseBody),
    myEquipment: Array.isArray(r.myEquipment) ? [...new Set(r.myEquipment.filter(e => EQUIPMENT_OPTIONS.includes(e) && e !== '맨몸'))] : [],
  }
}

const cacheKey = userId => `fit-settings:${userId}`
const readCache = userId => {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(userId)))
  } catch {
    return null
  }
}
const writeCache = (userId, settings) => {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(settings))
  } catch {
    /* 저장소를 못 쓰는 환경이면 캐시 없이 동작 */
  }
}

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id
  const [settings, setSettings] = useState(() => sanitizeSettings(userId ? readCache(userId) : null))
  // accountSync: true = 계정에 저장 중 / false = SQL 미실행이라 이 기기에만 저장 / null = 확인 중
  const [accountSync, setAccountSync] = useState(null)
  const [saveError, setSaveError] = useState('')
  const dbRef = useRef(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // settings 칼럼이 없으면(SQL 미실행) 기기 저장으로 동작한다
          dbRef.current = false
          setAccountSync(false)
          return
        }
        dbRef.current = true
        setAccountSync(true)
        const remote = data?.settings && Object.keys(data.settings).length ? data.settings : null
        if (remote) {
          const next = sanitizeSettings(remote)
          latestRef.current = next
          setSettings(next)
          writeCache(userId, next)
        } else {
          // 계정에 아직 설정이 없으면, 이 기기에 있던 설정을 계정으로 올린다
          const local = readCache(userId)
          if (local) supabase.from('profiles').update({ settings: sanitizeSettings(local) }).eq('id', userId).then(() => {})
        }
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // 상태 갱신 함수 안에서 요청을 보내면 개발 모드(StrictMode)에서 두 번 실행되므로, 최신 값은 ref로 들고 있다가 여기서 한 번만 저장한다.
  // 기기 저장은 바로, 계정 저장은 마지막 변경 뒤 잠깐 기다렸다가 한 번만 보낸다(휴식 시간 +/- 를 연타해도 요청은 한 번). 앱을 가리거나 닫을 때는 바로 보낸다.
  const latestRef = useRef(settings)
  const timerRef = useRef(null)
  const flush = useCallback(() => {
    if (!timerRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = null
    if (!userId || !dbRef.current) return
    supabase
      .from('profiles')
      .update({ settings: latestRef.current })
      .eq('id', userId)
      .then(({ error }) => setSaveError(error ? '설정을 계정에 저장하지 못했어요. 이 기기에는 저장됐어요.' : ''))
  }, [userId])

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  const update = useCallback(
    patch => {
      const next = sanitizeSettings({ ...latestRef.current, ...patch })
      latestRef.current = next
      setSettings(next)
      if (!userId) return
      writeCache(userId, next)
      if (dbRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(flush, SAVE_DELAY_MS)
      }
    },
    [userId, flush],
  )

  // 로그인 화면은 설정을 아직 못 불러오니, 마지막으로 쓴 테마를 따로 기억해 둔다(로그아웃 후·로그인 전에 같은 테마로 보이게)
  useEffect(() => {
    try {
      localStorage.setItem(LAST_THEME_KEY, settings.theme)
    } catch {
      /* 저장소를 못 쓰는 환경이면 기억하지 않는다 */
    }
  }, [settings.theme])

  const value = useMemo(() => ({ settings, update, accountSync, saveError }), [settings, update, accountSync, saveError])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}

// 기기의 다크 모드 설정(prefers-color-scheme). 바뀌면 바로 반영한다.
export function useSystemDark() {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = e => setSystemDark(e.matches)
    // 일부 환경은 변경 이벤트를 늦게/안 보내므로, 앱이 다시 보일 때(다른 앱·설정에서 돌아올 때)도 한 번 더 읽는다
    const recheck = () => document.visibilityState !== 'hidden' && setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    document.addEventListener('visibilitychange', recheck)
    window.addEventListener('focus', recheck)
    return () => {
      mq.removeEventListener('change', onChange)
      document.removeEventListener('visibilitychange', recheck)
      window.removeEventListener('focus', recheck)
    }
  }, [])
  return systemDark
}

// 지금 다크 모드로 보여야 하는지: 설정이 "시스템"이면 기기의 다크 모드 설정을 따라간다
export function useIsDark() {
  const { settings } = useSettings()
  const systemDark = useSystemDark()
  return settings.theme === 'dark' || (settings.theme === 'system' && systemDark)
}
