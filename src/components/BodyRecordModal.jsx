import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { calcBmi, calcBmr } from '../lib/bodyMetrics.js'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-ui-body outline-none focus:border-emerald-500'
const readOnlyClass = 'w-full border border-gray-100 bg-gray-50 text-gray-500 rounded-lg px-3 py-2 text-ui-body'

// 입력 항목 (BMI·BMR은 자동 계산이라 아래에서 따로 그린다). 표시 순서 = 요청받은 순서.
const FIELDS = [
  { key: 'heightCm', label: '키', unit: 'cm', min: 50, max: 250 },
  { key: 'weightKg', label: '몸무게', unit: 'kg', min: 10, max: 500 },
  { key: 'bmi', auto: true, label: 'BMI (자동 계산)' },
  { key: 'boneMassKg', label: '뼈 무게', unit: 'kg', min: 0, max: 50 },
  { key: 'bodyFatPct', label: '체지방률', unit: '%', min: 0, max: 100 },
  { key: 'muscleMassKg', label: '근육량', unit: 'kg', min: 0, max: 300 },
  { key: 'musclePct', label: '근육량률', unit: '%', min: 0, max: 100 },
  { key: 'proteinPct', label: '단백질', unit: '%', min: 0, max: 100 },
  { key: 'waterPct', label: '수분', unit: '%', min: 0, max: 100 },
  { key: 'skeletalMuscleKg', label: '골격근', unit: 'kg', min: 0, max: 300 },
  { key: 'bmr', auto: true, label: 'BMR (자동 계산)' },
]
const INPUT_KEYS = FIELDS.filter(f => !f.auto).map(f => f.key)

const getToday = () => {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const toForm = record => Object.fromEntries(INPUT_KEYS.map(k => [k, record?.[k] ?? '']))

export default function BodyRecordModal({ initialDate, onClose }) {
  const { user } = useAuth()
  const { bodyRecords, setBodyRecords } = useWorkoutLogs()
  const [date, setDate] = useState(initialDate || getToday())
  const [form, setForm] = useState(() => toForm(bodyRecords.find(r => r.date === (initialDate || getToday()))))
  const [profile, setProfile] = useState(null) // { gender, age, height_cm } — BMR 계산과 키 기본값에 쓴다
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('profiles')
      .select('gender, age, height_cm')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setProfile(data)
        // 그 날짜의 기록이 없고 키를 아직 안 적었다면 내 정보의 키를 기본값으로 채운다
        setForm(prev => (prev.heightCm === '' && data.height_cm ? { ...prev, heightCm: data.height_cm } : prev))
      })
    return () => {
      cancelled = true
    }
  }, [user.id])

  // 날짜를 바꾸면 그 날짜에 저장된 기록을 불러온다. 없으면 직전 기록의 키를 이어받는다.
  const handleDateChange = nextDate => {
    setDate(nextDate)
    setMessage('')
    const existing = bodyRecords.find(r => r.date === nextDate)
    if (existing) return setForm(toForm(existing))
    const lastHeight = bodyRecords.find(r => r.heightCm)?.heightCm ?? profile?.height_cm ?? ''
    setForm({ ...toForm(null), heightCm: lastHeight })
  }

  const bmi = useMemo(() => calcBmi(form.heightCm, form.weightKg), [form.heightCm, form.weightKg])
  const bmr = useMemo(() => calcBmr(form.heightCm, form.weightKg, profile?.age, profile?.gender), [form.heightCm, form.weightKg, profile])
  const bmrHint = !bmr && form.heightCm && form.weightKg && '내 정보에서 성별·나이를 입력하면 계산됩니다.'

  const handleSave = () => {
    if (!date) return setMessage('날짜를 선택해 주세요.')
    if (!form.weightKg) return setMessage('몸무게를 입력해 주세요.')
    for (const f of FIELDS.filter(f => !f.auto)) {
      const v = form[f.key]
      if (v !== '' && (Number(v) < f.min || Number(v) > f.max)) return setMessage(`${f.label}은(는) ${f.min}~${f.max} 사이로 입력해 주세요.`)
    }
    const existing = bodyRecords.find(r => r.date === date)
    const saved = {
      id: existing?.id ?? crypto.randomUUID(),
      date,
      ...Object.fromEntries(INPUT_KEYS.map(k => [k, form[k] === '' ? null : Number(form[k])])),
      bmi,
      bmr,
    }
    setBodyRecords(prev => (existing ? prev.map(r => (r.id === saved.id ? saved : r)) : [saved, ...prev]))
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[460px] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h3 className="font-black text-gray-800">신체 기록</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <label className="block">
            <span className="block text-ui-body font-bold text-gray-500 mb-1">날짜</span>
            <input type="date" value={date} onChange={e => handleDateChange(e.target.value)} className={inputClass} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(f => (
              <label key={f.key} className="block">
                <span className="block text-ui-body font-bold text-gray-500 mb-1">{f.auto ? f.label : `${f.label} (${f.unit})`}</span>
                {f.auto ? (
                  <input type="text" readOnly value={(f.key === 'bmi' ? bmi : bmr) ?? '-'} className={readOnlyClass} />
                ) : (
                  <input
                    type="number"
                    min={f.min}
                    max={f.max}
                    step="0.1"
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className={inputClass}
                  />
                )}
              </label>
            ))}
          </div>
          {bmrHint && <p className="text-ui-body font-bold text-gray-400">{bmrHint}</p>}
          {message && <p className="text-ui-caption font-bold text-red-500">{message}</p>}
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end">
          <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white text-ui-body font-black rounded-lg px-6 py-2 transition-colors">
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
