import { useState } from 'react'
import { useAuth, MIN_PASSWORD_LENGTH } from '../context/AuthContext.jsx'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-letusBlue'
const primaryBtn = 'w-full bg-letusBlue text-white font-black rounded-lg py-2.5 text-sm disabled:opacity-60'
const linkBtn = 'text-xs font-bold text-gray-400 hover:text-letusBlue'

// 아이디(이메일)의 앞 2자·뒤 2자만 남기고 가운데는 * 로 가린다 (@ 뒤 도메인은 그대로)
function maskId(email) {
  const [local, domain = ''] = email.split('@')
  const masked = local.length <= 4 ? local[0] + '*'.repeat(Math.max(local.length - 1, 0)) : local.slice(0, 2) + '*'.repeat(local.length - 4) + local.slice(-2)
  return domain ? `${masked}@${domain}` : masked
}

export default function Login() {
  const { signIn, signUp, findIdsByName, requestPasswordReset, authError } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'findId' | 'findPw'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  // 재설정 링크가 만료되었거나 이미 사용된 경우 등, 주소에 실려 온 인증 오류를 처음에 보여준다
  const [message, setMessage] = useState(authError ? `링크가 유효하지 않습니다: ${authError} 비밀번호 찾기를 다시 진행해 주세요.` : '')
  const [foundIds, setFoundIds] = useState(null) // 아이디 찾기 결과 (null이면 아직 검색 전)
  const [sentTo, setSentTo] = useState('') // 비밀번호 재설정 메일을 보낸 주소(마스킹해서 표시)

  const go = (nextMode, nextEmail) => {
    setMode(nextMode)
    if (nextEmail !== undefined) setEmail(nextEmail)
    setMessage('')
    setFoundIds(null)
    setSentTo('')
  }

  const handleSignIn = async e => {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) setMessage(error.message)
  }

  const handleSignUp = async e => {
    e.preventDefault()
    if (!name.trim()) return setMessage('이름을 입력해 주세요.')
    if (password.length < MIN_PASSWORD_LENGTH) return setMessage(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`)
    setBusy(true)
    setMessage('')
    const { data, error } = await signUp(email, password, name)
    setBusy(false)
    if (error) return setMessage(error.message)
    // 이메일 확인이 켜져 있으면 세션 없이 가입만 완료된다
    if (!data.session) setMessage('가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.')
  }

  const handleFindId = async e => {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const { ids, error } = await findIdsByName(name)
    setBusy(false)
    if (error) return setMessage(error.message)
    setFoundIds(ids)
  }

  const handleFindPw = async e => {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const { matched, error } = await requestPasswordReset(email, name)
    setBusy(false)
    if (error) return setMessage(error.message)
    if (!matched) return setMessage('아이디와 이름이 일치하는 계정이 없습니다.')
    setSentTo(email.trim())
  }

  return (
    <div className="min-h-screen bg-letusBg flex items-center justify-center p-5">
      <div className="w-full max-w-[360px] bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">TRAINING</h1>
          <p className="text-sm text-gray-400 font-bold mt-1">
            {{ signin: '로그인', signup: '회원가입', findId: '아이디 찾기', findPw: '비밀번호 찾기' }[mode]}
          </p>
        </div>

        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="아이디 (이메일)" autoComplete="email" className={inputClass} />
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호" autoComplete="current-password" className={inputClass} />
            {message && <p className="text-xs font-bold text-red-500">{message}</p>}
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? '처리 중...' : '로그인'}
            </button>
            <div className="flex justify-between">
              <button type="button" onClick={() => go('signup')} className={linkBtn}>
                회원가입
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={() => go('findId')} className={linkBtn}>
                  아이디 찾기
                </button>
                <button type="button" onClick={() => go('findPw')} className={linkBtn}>
                  비밀번호 찾기
                </button>
              </div>
            </div>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="이름" autoComplete="name" className={inputClass} />
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="아이디 (이메일)" autoComplete="email" className={inputClass} />
            <input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={`비밀번호 (${MIN_PASSWORD_LENGTH}자 이상)`}
              autoComplete="new-password"
              className={inputClass}
            />
            {message && <p className="text-xs font-bold text-red-500">{message}</p>}
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? '처리 중...' : '가입하기'}
            </button>
            <button type="button" onClick={() => go('signin')} className={`w-full ${linkBtn}`}>
              이미 계정이 있으신가요? 로그인
            </button>
          </form>
        )}

        {mode === 'findId' && (
          <div className="space-y-4">
            <form onSubmit={handleFindId} className="space-y-4">
              <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="가입한 이름" className={inputClass} />
              {message && <p className="text-xs font-bold text-red-500">{message}</p>}
              <button type="submit" disabled={busy} className={primaryBtn}>
                {busy ? '찾는 중...' : '찾기'}
              </button>
            </form>

            {foundIds && foundIds.length === 0 && <p className="text-xs font-bold text-gray-500">해당 이름으로 가입한 아이디가 없습니다.</p>}
            {foundIds &&
              foundIds.map(id => (
                <div key={id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="text-[11px] font-bold text-gray-400">아이디</p>
                    <p className="text-sm font-black text-gray-800 break-all">{id}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => go('signin', id)} className="flex-1 bg-letusBlue text-white text-xs font-black rounded-lg py-2">
                      로그인하기
                    </button>
                    <button type="button" onClick={() => go('findPw', id)} className="flex-1 border border-gray-200 text-gray-600 text-xs font-black rounded-lg py-2 hover:border-letusBlue hover:text-letusBlue">
                      비밀번호 찾기
                    </button>
                  </div>
                </div>
              ))}

            <button type="button" onClick={() => go('signin')} className={`w-full ${linkBtn}`}>
              로그인으로 돌아가기
            </button>
          </div>
        )}

        {mode === 'findPw' && (
          <div className="space-y-4">
            {sentTo ? (
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <p className="text-[11px] font-bold text-gray-400">본인 확인 완료</p>
                <p className="text-sm font-black text-gray-800 break-all">{maskId(sentTo)}</p>
                <p className="text-xs font-bold text-gray-500">위 주소로 비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 눌러 새 비밀번호를 설정해 주세요.</p>
              </div>
            ) : (
              <form onSubmit={handleFindPw} className="space-y-4">
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="아이디 (이메일)" autoComplete="email" className={inputClass} />
                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="가입한 이름" className={inputClass} />
                {message && <p className="text-xs font-bold text-red-500">{message}</p>}
                <button type="submit" disabled={busy} className={primaryBtn}>
                  {busy ? '확인 중...' : '비밀번호 찾기'}
                </button>
              </form>
            )}
            <button type="button" onClick={() => go('signin', sentTo || email)} className={`w-full ${linkBtn}`}>
              로그인으로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
