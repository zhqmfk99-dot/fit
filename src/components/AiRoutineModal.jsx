import { useState, useMemo } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useAiRoutine } from '../hooks/useAiRoutine.js'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { EQUIPMENT_OPTIONS } from '../lib/muscleMap.js'
import { buildTagIndex, matchesQuery } from '../lib/exerciseSearch.js'
import {
  AI_GOALS, AI_LEVELS, AI_FOCUS, AI_MINUTES, AI_NOTES_MAX, AI_MAX_INCLUDE, AI_MIN_CANDIDATES, AI_MUSCLE_GROUPS, muscleLabel, buildCatalogPayload,
} from '../lib/aiRoutine.js'

const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const MAX_AVOID = 20

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
          className={`px-3 min-h-[32px] rounded-full text-m-body font-bold transition-colors ${
            isOn(o) ? 'bg-letusBlue text-white' : 'bg-gray-100 text-gray-500 active:bg-gray-200'
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
    <label className="text-m-body font-bold text-gray-700">
      {label}
      {hint && <span className="ml-1.5 text-m-caption font-normal text-gray-400">{hint}</span>}
    </label>
    {children}
  </div>
)

// 운동 고르기: 이름·태그로 검색해서 칩으로 쌓는다. blockedIds는 다른 쪽(꼭 넣을/빼고 싶은)에서 이미 고른 운동이라 못 고르게 한다.
function ExercisePicker({ ids, onChange, catalog, tagsByName, blockedIds, max, placeholder, tone }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const byId = useMemo(() => new Map(catalog.map(e => [e.id, e])), [catalog])
  const suggestions = query.trim()
    ? catalog.filter(e => !ids.includes(e.id) && !blockedIds.includes(e.id) && matchesQuery(e.name, tagsByName.get(e.name), query)).slice(0, 8)
    : []
  const chipClass = tone === 'avoid' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-letusBlue'

  return (
    <div className="flex flex-col gap-1.5">
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ids.map(id => (
            <span key={id} className={`inline-flex items-center gap-1 pl-3 pr-1.5 min-h-[32px] rounded-full text-m-body font-bold ${chipClass}`}>
              {byId.get(id)?.name ?? id}
              <button type="button" aria-label={`${byId.get(id)?.name ?? id} 제거`} onClick={() => onChange(ids.filter(i => i !== id))} className="p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {ids.length < max ? (
        <div className="relative">
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-[4px] px-3.5 py-2 text-m-body focus:outline-none focus:border-letusBlue bg-white"
          />
          {open && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto max-h-[160px]">
              {suggestions.map(e => (
                <button
                  key={e.id}
                  type="button"
                  onMouseDown={ev => ev.preventDefault()}
                  onClick={() => {
                    onChange([...ids, e.id])
                    setQuery('')
                  }}
                  className="w-full text-left px-3 py-2 text-m-body text-gray-700 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  {e.name}
                  {e.equipment && <span className="ml-1.5 text-m-caption text-gray-400">{e.equipment}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <span className="text-m-caption text-gray-400">최대 {max}개까지 고를 수 있어요.</span>
      )}
    </div>
  )
}

const Toggle = ({ checked, onChange, title, desc }) => (
  <label className="flex items-start gap-2.5 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-letusBlue shrink-0" />
    <span className="flex flex-col">
      <span className="text-m-body font-bold text-gray-700">{title}</span>
      <span className="text-m-caption text-gray-400 leading-relaxed">{desc}</span>
    </span>
  </label>
)

// AI 루틴 만들어주기 — 조건을 고르면 루틴 등록 화면에 채울 초안을 만들어 onDraft로 넘긴다 (PWA용 화면)
export default function AiRoutineModal({ onClose, onDraft }) {
  const { loading, error, generate } = useAiRoutine()
  const { exercises: catalog } = useWorkoutLogs()
  const tagsByName = useMemo(() => buildTagIndex(catalog), [catalog])
  const [goal, setGoal] = useState(AI_GOALS[0])
  const [level, setLevel] = useState(AI_LEVELS[0])
  const [minutes, setMinutes] = useState(60)
  const [focus, setFocus] = useState(['전신'])
  const [muscles, setMuscles] = useState([]) // 세부 부위(선택) — 고르면 그 부위를 쓰는 운동만 후보가 된다
  const [showMuscles, setShowMuscles] = useState(false)
  const [equipment, setEquipment] = useState([])
  const [include, setInclude] = useState([])
  const [avoid, setAvoid] = useState([])
  const [repeatDays, setRepeatDays] = useState([])
  const [notes, setNotes] = useState('')
  // 개인화 체크박스(내 운동 기록 참고·체형 정보 전송)는 "설정"의 기본값을 쓰고, 여기서 바꾸면 설정에도 저장된다(계정에 저장).
  // 기본값: 운동 기록 참고 = 켬(운동 이름·부위 빈도만 보냄), 체형 정보 = 끔(건강 정보라서 직접 켜야 함)
  const { settings, update } = useSettings()
  const prefs = { useHistory: settings.aiUseHistory, useBody: settings.aiUseBody }
  const setPref = (key, value) => update(key === 'useHistory' ? { aiUseHistory: value } : { aiUseBody: value })

  // 집중 부위: 여러 개 고를 수 있다. "전신"은 다른 부위와 같이 고르지 않고(고르면 나머지 해제), 전부 해제하면 전신으로 돌아간다.
  const handleFocus = next => {
    const added = next.find(f => !focus.includes(f))
    if (added === '전신') return setFocus(['전신'])
    const rest = next.filter(f => f !== '전신')
    setFocus(rest.length ? rest : ['전신'])
  }

  // 지금 조건(장비·부위·빼고 싶은/꼭 넣을 운동)에 맞는 후보 운동 수 — 너무 적으면 미리 알려 준다
  const candidateCount = useMemo(() => buildCatalogPayload(catalog, equipment, avoid, include, muscles).length, [catalog, equipment, avoid, include, muscles])

  const handleSubmit = async () => {
    const draft = await generate({ goal, level, minutes, focus, muscles, equipment, notes: notes.trim() }, repeatDays, {
      include,
      avoid,
      useHistory: prefs.useHistory,
      useBody: prefs.useBody,
    })
    if (draft) onDraft(draft)
  }

  // 지금 설정에서 Gemini로 실제로 나가는 정보를 그대로 안내한다
  const sendsText = [
    '고른 조건',
    '운동 리스트(이름·부위·장비)',
    include.length > 0 && '꼭 넣을 운동',
    prefs.useHistory && '자주 한 운동·적게 한 부위(운동 이름·부위만)',
    prefs.useBody && '키·몸무게·성별·나이',
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[460px] overflow-hidden flex flex-col slide-up">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-white">
          <h3 className="text-m-body font-bold text-gray-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-letusBlue" />
            AI로 루틴 만들기
          </h3>
          <button type="button" onClick={onClose} disabled={loading} aria-label="닫기" className="text-gray-400 p-1 disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 bg-slate-50 overflow-y-auto max-h-[70vh] space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-m-body font-bold p-3 rounded border border-red-100">{error}</div>}

          <Field label="목표">
            <Pills options={AI_GOALS} value={goal} onChange={setGoal} />
          </Field>
          <Field label="운동 경력">
            <Pills options={AI_LEVELS} value={level} onChange={setLevel} />
          </Field>
          <Field label="운동 시간">
            <Pills options={AI_MINUTES} value={minutes} onChange={setMinutes} format={m => `${m}분`} />
          </Field>
          <Field label="집중 부위" hint="여러 개 선택 가능">
            <Pills options={AI_FOCUS} value={focus} onChange={handleFocus} multi />
          </Field>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowMuscles(v => !v)}
              aria-expanded={showMuscles}
              className="self-start text-m-body font-bold text-letusBlue min-h-[32px]"
            >
              {showMuscles ? '− 세부 부위 접기' : '+ 세부 부위 직접 고르기'}
              {muscles.length > 0 && ` (${muscles.length}개 선택)`}
            </button>
            {!showMuscles && muscles.length > 0 && <span className="text-m-caption text-gray-500">{muscles.map(muscleLabel).join(', ')}</span>}
            {showMuscles && (
              <div className="space-y-3 bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-m-caption text-gray-400 leading-relaxed">고른 부위를 쓰는 운동만 후보가 돼요.</span>
                  {muscles.length > 0 && (
                    <button type="button" onClick={() => setMuscles([])} className="shrink-0 text-m-caption font-bold text-gray-500 underline">
                      모두 해제
                    </button>
                  )}
                </div>
                {AI_MUSCLE_GROUPS.map(g => (
                  <div key={g.label} className="flex flex-col gap-1.5">
                    <span className="text-m-caption font-bold text-gray-500">{g.label}</span>
                    <Pills options={g.muscles} value={muscles} onChange={setMuscles} multi format={muscleLabel} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <Field label="사용할 장비" hint="아무것도 안 고르면 전체">
            <Pills options={EQUIPMENT_OPTIONS} value={equipment} onChange={setEquipment} multi />
          </Field>
          <Field label="꼭 넣고 싶은 운동" hint={`선택 · 최대 ${AI_MAX_INCLUDE}개`}>
            <ExercisePicker
              ids={include}
              onChange={setInclude}
              catalog={catalog}
              tagsByName={tagsByName}
              blockedIds={avoid}
              max={AI_MAX_INCLUDE}
              placeholder="운동 이름 검색"
            />
          </Field>
          <Field label="빼고 싶은 운동" hint="선택 · 싫어하거나 못 하는 운동">
            <ExercisePicker ids={avoid} onChange={setAvoid} catalog={catalog} tagsByName={tagsByName} blockedIds={include} max={MAX_AVOID} placeholder="운동 이름 검색" tone="avoid" />
          </Field>
          <div className={`text-m-caption font-bold ${candidateCount < AI_MIN_CANDIDATES ? 'text-red-500' : 'text-gray-500'}`}>
            조건에 맞는 운동 {candidateCount}개
            {candidateCount < AI_MIN_CANDIDATES && ` — ${AI_MIN_CANDIDATES}개 이상이어야 만들 수 있어요. 장비나 세부 부위를 넓혀 보세요.`}
          </div>
          <Field label="반복 요일" hint="선택">
            <Pills options={DAYS} value={repeatDays} onChange={setRepeatDays} multi />
          </Field>
          <Field label="추가 요청" hint="선택">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value.slice(0, AI_NOTES_MAX))}
              rows={2}
              placeholder="예: 무릎이 안 좋아서 점프 동작은 빼 주세요"
              className="border border-gray-300 rounded-[4px] px-3.5 py-2 text-m-body focus:outline-none focus:border-letusBlue bg-white resize-none"
            />
            <span className="text-m-caption text-gray-400 text-right">
              {notes.length}/{AI_NOTES_MAX}
            </span>
          </Field>

          <div className="space-y-3 pt-1 border-t border-gray-200">
            <div className="pt-3 text-m-body font-bold text-gray-700">내 정보 반영</div>
            <Toggle
              checked={prefs.useHistory}
              onChange={v => setPref('useHistory', v)}
              title="내 운동 기록 참고"
              desc="최근 3개월에 자주 한 운동은 선호로, 최근 4주에 안 쓴 부위는 보강 대상으로 봐요. 운동 이름·부위만 보내요."
            />
            <Toggle
              checked={prefs.useBody}
              onChange={v => setPref('useBody', v)}
              title="체형 정보 함께 보내기"
              desc="키·몸무게·성별·나이를 참고해 운동 선택과 강도를 조절해요. 건강 정보라서 직접 켠 때만 보내요."
            />
          </div>

          <p className="text-m-caption text-gray-400 leading-relaxed">
            Google Gemini로 전송되는 정보: {sendsText}. 이름·이메일은 보내지 않아요. AI가 만든 초안이니 저장 전에 꼭 확인해 주세요.
          </p>
        </div>

        <div className="p-4 border-t border-gray-200 bg-white flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 border border-gray-300 text-gray-600 text-m-body font-bold rounded-[3px] disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2.5 bg-letusBlue text-white text-m-body font-bold rounded-[3px] flex items-center gap-1.5 disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? '만드는 중… (최대 30초)' : '루틴 만들기'}
          </button>
        </div>
      </div>
    </div>
  )
}
