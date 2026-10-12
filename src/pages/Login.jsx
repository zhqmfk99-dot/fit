import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const { data, error } = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    if (error) return setMessage(error.message)
    // 이메일 확인이 켜져 있으면 세션 없이 가입만 완료된다
    if (mode === 'signup' && !data.session) setMessage('가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.')
  }

  return (
    <div className="min-h-screen bg-letusBg flex items-center justify-center p-5">
      <form onSubmit={handleSubmit} className="w-full max-w-[360px] bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">TRAINING</h1>
          <p className="text-sm text-gray-400 font-bold mt-1">{mode === 'signin' ? '로그인' : '회원가입'}</p>
        </div>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="이메일"
          autoComplete="email"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-letusBlue"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="비밀번호 (6자 이상)"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-letusBlue"
        />
        {message && <p className="text-xs font-bold text-red-500">{message}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-letusBlue text-white font-black rounded-lg py-2.5 text-sm disabled:opacity-60"
        >
          {busy ? '처리 중...' : mode === 'signin' ? '로그인' : '가입하기'}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setMessage('')
          }}
          className="w-full text-xs font-bold text-gray-400 hover:text-letusBlue"
        >
          {mode === 'signin' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </button>
      </form>
    </div>
  )
}
