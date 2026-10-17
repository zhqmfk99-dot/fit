import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth, MIN_PASSWORD_LENGTH } from '../context/AuthContext.jsx'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-m-body outline-none focus:border-letusBlue'
const readOnlyClass = 'w-full border border-gray-100 bg-gray-50 text-gray-500 rounded-lg px-3 py-2 text-m-body'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-m-body font-bold text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  )
}

// BMI = 몸무게(kg) / 키(m)^2. 키/몸무게가 없으면 계산하지 않는다.
function calcBmi(heightCm, weightKg) {
  const h = Number(heightCm)
  const w = Number(weightKg)
  if (!h || !w) return ''
  return (w / (h / 100) ** 2).toFixed(1)
}

export default function ProfileModal({ onClose }) {
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [gender, setGender] = useState('')
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('profiles')
      .select('name, gender, age, height_cm, weight_kg')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setMessage(error.message)
        if (data) {
          setName(data.name ?? '')
          setGender(data.gender ?? '')
          setAge(data.age ?? '')
          setHeight(data.height_cm ?? '')
          setWeight(data.weight_kg ?? '')
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user.id])

  const bmi = calcBmi(height, weight)

  const handleSave = async () => {
    if (!name.trim()) return setMessage('이름을 입력해 주세요.')
    if (password && password.length < MIN_PASSWORD_LENGTH) return setMessage(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`)
    setBusy(true)
    setMessage('')

    const { error } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        gender: gender || null,
        age: age === '' ? null : Number(age),
        height_cm: height === '' ? null : Number(height),
        weight_kg: weight === '' ? null : Number(weight),
      })
      .eq('id', user.id)
    if (error) {
      setBusy(false)
      return setMessage(error.message)
    }

    // 비밀번호는 입력했을 때만 변경한다. 이름은 가입 정보(user_metadata)에도 맞춰 둔다.
    const authUpdate = { data: { name: name.trim() } }
    if (password) authUpdate.password = password
    const { error: authError } = await supabase.auth.updateUser(authUpdate)
    setBusy(false)
    if (authError) return setMessage(authError.message)
    onClose()
  }

  const handleWithdraw = async () => {
    if (!confirm('정말 탈퇴할까요?\n운동 기록, 루틴, 운동 리스트 등 모든 데이터가 삭제되며 되돌릴 수 없습니다.')) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setBusy(false)
      return setMessage(error.message)
    }
    await signOut()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[420px] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h3 className="text-m-title font-black text-gray-800">내 정보</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          {loading ? (
            <p className="text-m-body font-bold text-gray-400 text-center py-8">불러오는 중...</p>
          ) : (
            <>
              <Field label="아이디">
                <input type="text" value={user.email} readOnly className={readOnlyClass} />
              </Field>
              <Field label="이름">
                <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} />
              </Field>
              <Field label="비밀번호">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="변경할 때만 입력"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="성별">
                  <select value={gender} onChange={e => setGender(e.target.value)} className={inputClass}>
                    <option value="">선택 안 함</option>
                    <option value="남성">남성</option>
                    <option value="여성">여성</option>
                  </select>
                </Field>
                <Field label="나이">
                  <input type="number" min="1" max="120" value={age} onChange={e => setAge(e.target.value)} className={inputClass} />
                </Field>
                <Field label="키 (cm)">
                  <input type="number" min="50" max="250" step="0.1" value={height} onChange={e => setHeight(e.target.value)} className={inputClass} />
                </Field>
                <Field label="몸무게 (kg)">
                  <input type="number" min="10" max="500" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="BMI (키·몸무게로 자동 계산)">
                <input type="text" value={bmi || '-'} readOnly className={readOnlyClass} />
              </Field>
              {message && <p className="text-m-caption font-bold text-red-500">{message}</p>}
            </>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex items-center justify-between">
          <button onClick={handleWithdraw} disabled={busy || loading} className="text-m-caption font-bold text-gray-400 hover:text-red-500 disabled:opacity-60">
            회원 탈퇴
          </button>
          <button onClick={handleSave} disabled={busy || loading} className="bg-letusBlue text-white text-m-body font-black rounded-lg px-6 py-2 disabled:opacity-60">
            {busy ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
