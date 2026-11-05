import { useEffect, useMemo, useState } from 'react'
import { X, ArrowRight, Search } from 'lucide-react'
import { MUSCLE_LABELS } from '../../lib/muscleMap.js'
import { equipmentBadgeClass } from '../../lib/equipmentStyle.js'
import { suggestSwaps } from '../../lib/exerciseSwap.js'

const labelsOf = muscles => (muscles || []).map(m => MUSCLE_LABELS[m] || m)

// 운동 바꾸기 시트 (웹앱용 화면 - PWA는 components/mobile/SwapExerciseSheet.jsx) — 지금 운동과 같은 부위를 쓰는 운동을 먼저 보여 주고, 고르면 "오늘만 / 루틴에도"를 묻는다.
//   log: 바꿀 오늘 기록 / catalog: 운동 리스트 / excludeNames: 후보에서 뺄 이름(오늘 목록에 있는 운동) / myEquipment: 설정의 내 운동기구
//   canApplyToRoutine: 루틴에도 반영할 수 있는가(이 기록의 운동이 루틴에 있을 때) / routineNames: 루틴에 이미 있는 운동 이름 / weightFor(name): 그 운동의 지난 무게(없으면 null)
//   onPick(exercise, scope): scope = 'today' | 'routine'
export default function SwapExerciseModal({ log, catalog, excludeNames, myEquipment, canApplyToRoutine, routineNames, weightFor, onPick, onClose }) {
  // Esc 키로 닫는다(웹앱은 뒤로가기 제스처가 없다)
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const current = useMemo(() => catalog.find(e => e.name === log.exercise) || { name: log.exercise, muscles: [] }, [catalog, log.exercise])
  const [query, setQuery] = useState('')
  const [showOther, setShowOther] = useState(false)
  const [picked, setPicked] = useState(null)
  const { same, other } = useMemo(() => suggestSwaps(current, catalog, { excludeNames, myEquipment, query }), [current, catalog, excludeNames, myEquipment, query])
  // 검색 중에는 다른 부위도 바로 보여 준다(찾는 운동이 거기 있을 수 있어서)
  const otherVisible = showOther || query.trim().length > 0

  // 컴포넌트가 아니라 JSX를 돌려주는 함수(렌더마다 새 컴포넌트가 만들어져 다시 그려지는 것을 피한다)
  const renderRow = s => {
    const e = s.exercise
    const on = picked?.name === e.name
    return (
      <button
        key={e.name}
        type="button"
        onClick={() => setPicked(e)}
        aria-pressed={on}
        className={`w-full text-left rounded-xl border px-3 py-2.5 min-h-[52px] transition-colors ${on ? 'bg-blue-50 border-letusBlue' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-ui-body font-bold text-gray-800 min-w-0 truncate">{e.name}</span>
          <span className="shrink-0 flex items-center gap-1">
            {s.samePattern && <span className="text-ui-caption font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">{e.movementPattern}</span>}
            {e.equipment && <span className={`text-ui-caption font-bold px-2 py-0.5 rounded-full ${equipmentBadgeClass(e.equipment)}`}>{e.equipment}</span>}
          </span>
        </div>
        <div className="mt-0.5 text-ui-caption text-gray-400 truncate">{labelsOf(e.muscles).join(' · ') || '-'}</div>
        {!s.usable && <div className="mt-0.5 text-ui-caption font-bold text-orange-600">내 운동기구에 없는 기구예요</div>}
      </button>
    )
  }

  const pickedWeight = picked ? weightFor(picked.name) : null
  // 이미 루틴에 있는 운동으로는 루틴을 바꿀 수 없다(루틴에 같은 운동이 두 번 생기므로)
  const inRoutine = !!picked && routineNames.has(picked.name)
  const routineOk = canApplyToRoutine && !inRoutine

  return (
    <div className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4 backdrop-blur-sm fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[520px] max-h-[86vh] flex flex-col slide-up">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h3 className="text-ui-title font-black text-gray-800">운동 바꾸기</h3>
            <div className="text-ui-caption font-bold text-gray-400 truncate">
              지금: {log.exercise}
              {labelsOf(current.muscles).length > 0 && ` · ${labelsOf(current.muscles).join(' · ')}`}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-8 h-8 -mr-1 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="운동 이름·별칭 검색"
              className="w-full border border-gray-300 rounded-[4px] pl-9 pr-3 py-2 text-ui-body bg-white focus:outline-none focus:border-letusBlue"
            />
          </div>

          <div className="text-ui-caption font-bold text-gray-500">
            같은 부위 운동 {same.length}개 <span className="font-normal text-gray-400">· 지금 운동의 주 근육을 쓰는 운동이 위에 있어요</span>
          </div>
          {same.length === 0 ? (
            <p className="text-ui-caption text-gray-400 leading-relaxed">{query.trim() ? '검색 결과가 없어요.' : '같은 부위를 쓰는 다른 운동이 없어요. 아래에서 다른 부위 운동을 골라 보세요.'}</p>
          ) : (
            <div className="space-y-2">
              {same.map(renderRow)}
            </div>
          )}

          {other.length > 0 && (
            <>
              {!query.trim() && (
                <button type="button" onClick={() => setShowOther(v => !v)} aria-expanded={showOther} className="min-h-[36px] text-ui-body font-bold text-letusBlue">
                  {showOther ? '− 다른 부위 운동 접기' : `+ 다른 부위 운동도 보기 (${other.length}개)`}
                </button>
              )}
              {otherVisible && (
                <div className="space-y-2">
                  {query.trim() && <div className="text-ui-caption font-bold text-gray-500">다른 부위 운동 {other.length}개</div>}
                  {other.map(renderRow)}
                </div>
              )}
            </>
          )}
        </div>

        {picked && (
          <div className="shrink-0 border-t border-gray-200 bg-white px-5 py-3 space-y-2">
            <div className="flex items-center gap-1.5 text-ui-body font-bold text-gray-800 min-w-0">
              <span className="truncate text-gray-400">{log.exercise}</span>
              <ArrowRight className="w-4 h-4 shrink-0 text-letusBlue" />
              <span className="truncate">{picked.name}</span>
            </div>
            <p className="text-ui-caption text-gray-500 leading-relaxed">
              세트·횟수·휴식은 그대로예요.{' '}
              {pickedWeight ? `무게는 이 운동의 지난 기록(${pickedWeight}kg)으로 시작해요.` : '이 운동의 기록이 없어서 무게는 0kg로 시작해요. 운동 화면에서 직접 입력해 주세요.'}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => onPick(picked, 'today')} className="flex-1 min-h-[44px] rounded-xl bg-letusBlue text-white text-ui-body font-bold hover:bg-blue-600">
                오늘만 바꾸기
              </button>
              {routineOk && (
                <button type="button" onClick={() => onPick(picked, 'routine')} className="flex-1 min-h-[44px] rounded-xl border border-letusBlue text-letusBlue text-ui-body font-bold hover:bg-blue-50">
                  루틴에도 반영
                </button>
              )}
            </div>
            {routineOk && <p className="text-ui-caption text-gray-400 leading-relaxed">"루틴에도 반영"은 루틴과, 앞으로 예정된 같은 운동 기록도 바꿔요. 이미 한 기록은 그대로예요.</p>}
            {canApplyToRoutine && inRoutine && <p className="text-ui-caption text-gray-400 leading-relaxed">이 운동은 이미 루틴에 있어서 오늘만 바꿀 수 있어요.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
