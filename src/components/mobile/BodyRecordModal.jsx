import { useBackHandler } from '../../context/BackNavigationContext.jsx'
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import DateInput from '../DateInput.jsx'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useWorkoutLogs } from '../../context/WorkoutLogsContext.jsx'
import { calcBmi, calcBmr } from '../../lib/bodyMetrics.js'

const inputClass = 'w-full h-11 px-3 border border-gray-300 rounded-lg text-m-body bg-white focus:outline-none focus:border-emerald-500'
const readOnlyClass = 'w-full h-11 px-3 border border-gray-100 bg-gray-50 text-gray-500 rounded-lg text-m-body flex items-center'

// 입력 항목 (BMI·BMR은 자동 계산). 표시 순서 = 웹앱과 같다.
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

// PWA(모바일) 전용 신체 기록 입력 — 아래에서 올라오는 시트. (웹앱은 components/BodyRecordModal.jsx)
// 날짜당 한 건: 같은 날짜로 다시 저장하면 그 날짜 기록을 덮어쓴다.
export default function BodyRecordModal({ initialDate, onClose }) {
  useBackHandler(onClose) // 뒤로가기(제스처)로 이 창을 닫는다
  const { user } = useAuth()
  const { bodyRecords, setBodyRecords } = useWorkoutLogs()
  const startDate = initialDate || getToday()
  const [date, setDate] = useState(startDate)
  const [form, setForm] = useState(() => toForm(bodyRecords.find(r => r.date === startDate)))
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
  const bmrHint = !bmr && form.heightCm && form.weightKg && '내 정보에서 성별·나이를 입력하면 BMR이 계산됩니다.'

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
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm fade-in" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full bg-white rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col slide-up">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
          <h3 className="text-m-title font-bold text-gray-800">신체 기록</h3>
          <button onClick={onClose} className="text-gray-400 w-9 h-9 flex items-center justify-center" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <label className="block">
            <span className="block text-m-caption font-bold text-gray-500 mb-1">날짜</span>
            <DateInput value={date} onChange={handleDateChange} fullWidth />
          </label>

          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(f => (
              <label key={f.key} className="block min-w-0">
                <span className="block text-m-caption font-bold text-gray-500 mb-1">{f.auto ? f.label : `${f.label} (${f.unit})`}</span>
                {f.auto ? (
                  <div className={readOnlyClass}>{(f.key === 'bmi' ? bmi : bmr) ?? '-'}</div>
                ) : (
                  <input
                    type="number"
                    inputMode="decimal"
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
          {bmrHint && <p className="text-m-caption font-bold text-gray-400">{bmrHint}</p>}
          {message && <p className="text-m-body font-bold text-red-500">{message}</p>}
        </div>

        <div className="p-4 border-t border-gray-100 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={handleSave} className="w-full h-12 bg-emerald-600 active:bg-emerald-700 text-white text-m-body font-bold rounded-lg transition-colors">
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
