import { X, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useBackHandler } from '../../context/BackNavigationContext.jsx'
import { useSplitPlanner } from '../../hooks/useSplitPlanner.js'
import { SPLIT_GROUPS, PER_DAY_OPTIONS, WEEKDAYS, MAX_PRESET_DAYS, MAX_DAY_GROUPS, MAX_CUSTOM_PRESETS } from '../../lib/splitPlan.js'

const chip = on => `min-h-[36px] px-3 rounded-full border text-m-body font-bold ${on ? 'bg-blue-50 border-letusBlue text-letusBlue' : 'bg-white border-gray-200 text-gray-600 active:bg-gray-50'}`

// 분할 루틴 한 번에 만들기 창 (PWA용 화면) — 프리셋을 고르면 요일마다 루틴을 만든다(AI 없음). 규칙은 lib/splitPlan.js(웹앱과 공용). 웹앱은 components/web/SplitPlanModal.jsx.
export default function SplitPlanModal({ onClose }) {
  useBackHandler(onClose) // 뒤로가기(제스처)로 이 창을 닫는다
  const sp = useSplitPlanner()

  return (
    <div className="fixed inset-0 bg-black/40 z-[110] flex items-end justify-center backdrop-blur-sm fade-in">
      <div className="bg-white rounded-t-2xl shadow-2xl w-full max-w-[460px] max-h-[90vh] flex flex-col slide-up">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <h3 className="text-m-title font-black text-gray-800">분할로 한 번에 만들기</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-11 h-11 -mr-2 flex items-center justify-center text-gray-400 active:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3">
          {sp.view === 'pick' && (
            <>
              <p className="text-m-caption text-gray-500 leading-relaxed">분할을 고르면 요일마다 루틴을 하나씩 만들어요. 운동은 내 운동 리스트와 최근 기록에서 부위별로 골라요(AI를 쓰지 않아요). 만든 뒤 루틴 수정에서 바꿀 수 있어요.</p>
              <div className="space-y-2" role="list">
                {sp.presets.map(p => {
                  const isCustom = sp.custom.some(c => c.id === p.id)
                  return (
                    <div key={p.id} role="listitem" className="flex items-stretch gap-2">
                      <button type="button" onClick={() => sp.choose(p.id)} className="flex-1 min-w-0 text-left rounded-xl border border-gray-200 px-4 py-3 min-h-[56px] active:bg-gray-50">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-m-body font-bold text-gray-800 truncate">{p.name}</span>
                          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                        </div>
                        <div className="text-m-caption text-gray-400">
                          {p.days.length}일 · {isCustom ? '내 분할' : '기본'}
                        </div>
                      </button>
                      {isCustom && (
                        <>
                          <button type="button" onClick={() => sp.startEdit(p.id)} className="shrink-0 px-3 rounded-xl border border-gray-200 text-m-caption font-bold text-gray-600 active:bg-gray-50">
                            고치기
                          </button>
                          <button type="button" onClick={() => sp.deleteCustom(p.id)} aria-label={`${p.name} 삭제`} className="shrink-0 w-11 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 active:bg-gray-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => sp.startEdit(null)}
                disabled={sp.custom.length >= MAX_CUSTOM_PRESETS}
                className="w-full min-h-[44px] rounded-xl border-2 border-dashed border-gray-300 text-m-body font-bold text-gray-500 active:border-letusBlue active:text-letusBlue disabled:opacity-40"
              >
                <Plus className="inline w-4 h-4 mr-1 -mt-0.5" />내 분할 만들기{sp.custom.length >= MAX_CUSTOM_PRESETS ? ` (${MAX_CUSTOM_PRESETS}개까지)` : ''}
              </button>
            </>
          )}

          {sp.view === 'edit' && (
            <>
              <input
                value={sp.draft.name}
                onChange={e => sp.setDraftName(e.target.value)}
                placeholder="분할 이름 (예: 내 3분할)"
                aria-label="분할 이름"
                className="w-full border border-gray-300 rounded-[4px] px-3 py-2 text-m-body bg-white focus:outline-none focus:border-letusBlue"
              />
              {sp.draft.days.map((day, i) => (
                <div key={i} className="rounded-xl border border-gray-200 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-m-body font-bold text-gray-700">{i + 1}일차</span>
                    {sp.draft.days.length > 1 && (
                      <button type="button" onClick={() => sp.removeDraftDay(i)} className="min-h-[32px] px-2 text-m-caption font-bold text-gray-400 active:text-red-500">
                        이 날 빼기
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`${i + 1}일차 부위`}>
                    {SPLIT_GROUPS.map(g => (
                      <button key={g} type="button" aria-pressed={day.groups.includes(g)} onClick={() => sp.toggleDraftGroup(i, g)} className={chip(day.groups.includes(g))}>
                        {g}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 text-m-caption text-gray-400">부위는 하루에 {MAX_DAY_GROUPS}개까지 고를 수 있어요.</div>
                </div>
              ))}
              {sp.draft.days.length < MAX_PRESET_DAYS && (
                <button type="button" onClick={sp.addDraftDay} className="min-h-[40px] px-4 rounded-full border border-gray-300 text-m-body font-bold text-gray-600 active:bg-gray-50">
                  + 요일 추가
                </button>
              )}
              {sp.draftError && <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-m-caption font-bold text-red-600">{sp.draftError}</div>}
              <div className="flex gap-2">
                <button type="button" onClick={() => sp.setView('pick')} className="flex-1 min-h-[44px] rounded-xl border border-gray-300 text-m-body font-bold text-gray-600 active:bg-gray-50">
                  취소
                </button>
                <button type="button" onClick={sp.saveDraft} className="flex-1 min-h-[44px] rounded-xl bg-letusBlue text-white text-m-body font-bold active:bg-blue-600">
                  저장하고 계속
                </button>
              </div>
            </>
          )}

          {sp.view === 'preview' && sp.preset && (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-m-body font-bold text-gray-800 truncate">{sp.preset.name}</div>
                  <div className="text-m-caption text-gray-400">{sp.preset.days.length}일 분할</div>
                </div>
                <button type="button" onClick={() => sp.setView('pick')} className="shrink-0 min-h-[32px] px-3 rounded-full border border-gray-200 text-m-caption font-bold text-gray-600 active:bg-gray-50">
                  다른 분할
                </button>
              </div>

              <div>
                <div className="text-m-caption font-bold text-gray-500 mb-1">하루 운동 수</div>
                <div className="flex gap-1.5" role="group" aria-label="하루 운동 수">
                  {PER_DAY_OPTIONS.map(n => (
                    <button key={n} type="button" aria-pressed={sp.perDay === n} onClick={() => sp.setPerDay(n)} className={chip(sp.perDay === n)}>
                      {n}개
                    </button>
                  ))}
                </div>
              </div>

              {sp.plan.map((day, i) => (
                <div key={i} className="rounded-xl border border-gray-200 px-3 py-3">
                  <div className="text-m-body font-black text-gray-800">{day.label}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label={`${day.label} 요일`}>
                    {WEEKDAYS.map(wd => (
                      <button
                        key={wd}
                        type="button"
                        aria-pressed={sp.weekdays[i]?.includes(wd)}
                        onClick={() => sp.toggleWeekday(i, wd)}
                        className={`w-9 h-9 rounded-full border text-m-caption font-bold ${sp.weekdays[i]?.includes(wd) ? 'bg-letusBlue border-letusBlue text-white' : 'bg-white border-gray-200 text-gray-500 active:bg-gray-50'}`}
                      >
                        {wd}
                      </button>
                    ))}
                  </div>
                  {day.items.length === 0 ? (
                    <div className="mt-2 text-m-caption font-bold text-orange-600">이 날에 맞는 운동이 운동 리스트에 없어요(내 운동기구 설정도 확인해 보세요). 이 날 루틴은 만들지 않아요.</div>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {day.items.map(it => (
                        <li key={it.exercise} className="flex items-center justify-between gap-2 text-m-body">
                          <span className="min-w-0">
                            <span className="font-bold text-gray-700">{it.exercise}</span>
                            <span className="text-gray-400">
                              {' '}
                              {it.sets}×{it.unilateral ? '한쪽 ' : ''}
                              {it.reps}
                            </span>
                          </span>
                          {it.weight != null ? (
                            <span className="shrink-0 text-m-caption font-bold text-gray-500">{it.weight}kg</span>
                          ) : it.needsWeight ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.5"
                              value={sp.weights[it.exercise] ?? ''}
                              onChange={e => sp.setWeight(it.exercise, e.target.value)}
                              placeholder="무게 kg"
                              aria-label={`${it.exercise} 무게`}
                              className="shrink-0 w-24 border border-orange-300 rounded-[4px] px-2 py-1.5 text-m-caption text-right bg-white focus:outline-none focus:border-letusBlue"
                            />
                          ) : (
                            <span className="shrink-0 text-m-caption font-bold text-gray-400">맨몸</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              {sp.missingWeight > 0 && <div className="rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-m-caption font-bold text-orange-700 leading-relaxed">기록이 없는 운동 {sp.missingWeight}개는 무게를 직접 넣어 주세요(처음이면 10회를 2~3회 남기고 할 수 있는 가벼운 무게). 비워 두면 맨몸으로 기록돼요.</div>}
              <p className="text-m-caption text-gray-400 leading-relaxed">운동은 내 운동 리스트와 최근 90일 기록으로 고른 제안이에요. 세트·횟수·휴식은 기본값(복합 3×8, 단관절 3×12)이고 만든 뒤 루틴 수정에서 바꿀 수 있어요.</p>

              <button
                type="button"
                onClick={sp.create}
                disabled={sp.routineCount === 0}
                className="w-full min-h-[48px] rounded-xl bg-letusBlue text-white text-m-body font-bold active:bg-blue-600 disabled:opacity-40"
              >
                {sp.routineCount === 0 ? '만들 루틴이 없어요' : `루틴 ${sp.routineCount}개 만들기`}
              </button>
            </>
          )}

          {sp.view === 'done' && sp.done && (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="text-m-body font-bold text-emerald-700">
                  루틴 {sp.done.routines}개(운동 {sp.done.exercises}개)를 만들었어요.
                </div>
                <div className="mt-1 text-m-caption text-emerald-700/80 leading-relaxed">루틴 목록에서 확인하고 필요하면 운동·세트·무게를 바꿔 주세요. 정한 요일에 맞춰 운동 예정이 채워져요.</div>
              </div>
              {sp.done.missingWeight > 0 && <div className="rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-m-caption font-bold text-orange-700 leading-relaxed">무게가 비어 있는 운동 {sp.done.missingWeight}개는 루틴 수정에서 무게를 넣어 주세요.</div>}
              <button type="button" onClick={onClose} className="w-full min-h-[44px] rounded-xl bg-letusBlue text-white text-m-body font-bold active:bg-blue-600">
                확인
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
