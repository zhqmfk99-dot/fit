import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

export const MIN_PASSWORD_LENGTH = 6 // Supabase 기본 최소 길이와 맞춤

// 재설정 메일 링크는 주소 뒤 #해시로 토큰(또는 오류)을 싣고 온다.
// Supabase가 이 해시를 처리하며 보내는 PASSWORD_RECOVERY 이벤트는 React가 구독하기 전에 지나갈 수 있어서,
// 모듈이 로드되는 시점(해시가 지워지기 전)에 미리 읽어 둔다.
const initialHash = new URLSearchParams(window.location.hash.slice(1))
const startedInRecovery = initialHash.get('type') === 'recovery'
const initialAuthError = initialHash.get('error_description')?.replace(/\+/g, ' ') ?? ''

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // 비밀번호 재설정 메일의 링크로 들어온 경우 true — 새 비밀번호를 입력받을 때까지 앱 대신 재설정 화면을 보여준다
  const [recovery, setRecovery] = useState(startedInRecovery)
  const [authError, setAuthError] = useState(initialAuthError)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signUp = (email, password, name) => supabase.auth.signUp({ email, password, options: { data: { name: name.trim() } } })
  const signOut = () => supabase.auth.signOut()

  // 이름으로 가입한 아이디(이메일) 전부 조회
  const findIdsByName = async name => {
    const { data, error } = await supabase.rpc('find_ids_by_name', { p_name: name })
    return { ids: (data ?? []).map(r => r.email), error }
  }

  // 아이디+이름이 일치하면 재설정 메일을 보낸다. 일치하지 않으면 matched=false
  const requestPasswordReset = async (email, name) => {
    const { data: matched, error } = await supabase.rpc('check_id_name', { p_email: email, p_name: name })
    if (error) return { matched: false, error }
    if (!matched) return { matched: false, error: null }
    const { error: mailError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    return { matched: true, error: mailError }
  }

  const updatePassword = async password => {
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) setRecovery(false)
    return { error }
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, recovery, authError, clearAuthError: () => setAuthError(''), signIn, signUp, signOut, findIdsByName, requestPasswordReset, updatePassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
