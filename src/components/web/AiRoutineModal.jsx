import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useAiRoutine } from '../../hooks/useAiRoutine.js'
import { EQUIPMENT_OPTIONS } from '../../lib/muscleMap.js'
import { AI_GOALS, AI_LEVELS, AI_FOCUS, AI_MINUTES, AI_NOTES_MAX } from '../../lib/aiRoutine.js'

const DAYS = ['월', '화', '수', '목', '금', '토', '일']

function Pills({ options, value, onChange, multi = false, format = v => v }) {
  const isOn = o => (multi ? value.includes(o) : value === o)
  const toggle = o => (multi ? onChange(value.includes(o) ? value.filter(v => v !== o) : [...value, o]) : onChange(o))
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button
          key={o}
          type="button"
          aria-pressed={isOn(o)}
          onClick={() => toggle(o)}
          className={`px-3 min-h-[32px] rounded-full text-ui-body font-bold transition-colors ${
            isOn(o) ? 'bg-letusBlue text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {format(o)}
        </button>
      ))}
    </div>
  )
}

const Field = ({ label, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-ui-body font-bold text-gray-700">
      {label}
      {hint && <span className="ml-1.5 text-ui-caption font-normal text-gray-400">{hint}</span>}
    </label>
    {children}
  </div>
)

// AI 루틴 만들어주기 — 조건을 고르면 루틴 등록 화면에 채울 초안을 만들어 onDraft로 넘긴다 (웹앱용 화면)
export default function AiRoutineModal({ onClose, onDraft }) {
  const { loading, error, generate } = useAiRoutine()
  const [goal, setGoal] = useState(AI_GOALS[0])
  const [level, setLevel] = useState(AI_LEVELS[0])
  const [minutes, setMinutes] = useState(60)
  const [focus, setFocus] = useState(AI_FOCUS[0])
  const [equipment, setEquipment] = useState([])
  const [repeatDays, setRepeatDays] = useState([])
  const [notes, setNotes] = useState('')

  const handleSubmit = async () => {
    const draft = await generate({ goal, level, minutes, focus, equipment, notes: notes.trim() }, repeatDays)
    if (draft) onDraft(draft)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[460px] overflow-hidden flex flex-col slide-up">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-white">
          <h3 className="text-ui-body font-bold text-gray-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-letusBlue" />
            AI로 루틴 만들기
          </h3>
          <button type="button" onClick={onClose} disabled={loading} aria-label="닫기" className="text-gray-400 p-1 disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 bg-slate-50 overflow-y-auto max-h-[70vh] space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-ui-body font-bold p-3 rounded border border-red-100">{error}</div>}

          <Field label="목표">
            <Pills options={AI_GOALS} value={goal} onChange={setGoal} />
          </Field>
          <Field label="운동 경력">
            <Pills options={AI_LEVELS} value={level} onChange={setLevel} />
          </Field>
          <Field label="운동 시간">
            <Pills options={AI_MINUTES} value={minutes} onChange={setMinutes} format={m => `${m}분`} />
          </Field>
          <Field label="집중 부위">
            <Pills options={AI_FOCUS} value={focus} onChange={setFocus} />
          </Field>
          <Field label="사용할 장비" hint="아무것도 안 고르면 전체">
            <Pills options={EQUIPMENT_OPTIONS} value={equipment} onChange={setEquipment} multi />
          </Field>
          <Field label="반복 요일" hint="선택">
            <Pills options={DAYS} value={repeatDays} onChange={setRepeatDays} multi />
          </Field>
          <Field label="추가 요청" hint="선택">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value.slice(0, AI_NOTES_MAX))}
              rows={2}
              placeholder="예: 무릎이 안 좋아서 점프 동작은 빼 주세요"
              className="border border-gray-300 rounded-[4px] px-3.5 py-2 text-ui-body focus:outline-none focus:border-letusBlue bg-white resize-none"
            />
            <span className="text-ui-caption text-gray-400 text-right">
              {notes.length}/{AI_NOTES_MAX}
            </span>
          </Field>

          <p className="text-ui-caption text-gray-400 leading-relaxed">
            고른 조건과 운동 리스트(이름·부위·장비)가 Google Gemini로 전송됩니다. 이름·이메일·신체 정보는 보내지 않아요. AI가 만든 초안이니 저장 전에 꼭 확인해 주세요.
          </p>
        </div>

        <div className="p-4 border-t border-gray-200 bg-white flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 border border-gray-300 text-gray-600 text-ui-body font-bold rounded-[3px] disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2.5 bg-letusBlue text-white text-ui-body font-bold rounded-[3px] flex items-center gap-1.5 disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? '만드는 중… (최대 30초)' : '루틴 만들기'}
          </button>
        </div>
      </div>
    </div>
  )
}
