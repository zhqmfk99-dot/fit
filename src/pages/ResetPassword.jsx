import { useState } from 'react'
import { useAuth, MIN_PASSWORD_LENGTH } from '../context/AuthContext.jsx'

// 비밀번호 재설정 메일의 링크로 들어왔을 때 새 비밀번호를 입력받는 화면
export default function ResetPassword() {
  const { updatePassword, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) return setMessage(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`)
    if (password !== confirm) return setMessage('비밀번호가 서로 다릅니다.')
    setBusy(true)
    setMessage('')
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) setMessage(error.message)
  }

  return (
    <div className="min-h-screen bg-letusBg flex items-center justify-center p-5">
      <form onSubmit={handleSubmit} className="w-full max-w-[360px] bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">TRAINING</h1>
          <p className="text-sm text-gray-400 font-bold mt-1">새 비밀번호 설정</p>
        </div>
        <input
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={`새 비밀번호 (${MIN_PASSWORD_LENGTH}자 이상)`}
          autoComplete="new-password"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-letusBlue"
        />
        <input
          type="password"
          required
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="새 비밀번호 확인"
          autoComplete="new-password"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-letusBlue"
        />
        {message && <p className="text-xs font-bold text-red-500">{message}</p>}
        <button type="submit" disabled={busy} className="w-full bg-letusBlue text-white font-black rounded-lg py-2.5 text-sm disabled:opacity-60">
          {busy ? '변경 중...' : '비밀번호 변경'}
        </button>
        <button type="button" onClick={signOut} className="w-full text-xs font-bold text-gray-400 hover:text-letusBlue">
          취소
        </button>
      </form>
    </div>
  )
}
