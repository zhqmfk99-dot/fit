// 운동 기록 수정 창(웹앱·PWA 공용)에서 저장할 수행 세트를 만든다 — 웹앱·PWA 공용 로직(UI 아님).
//
// 이 창은 "세트 수·횟수·무게" 세 칸만 받아서 예전에는 저장할 때마다 세트를 전부 새로 만들었다. 그러면 운동 진행 화면이 기록해 둔 세트별 시작·종료 시각(startedAt/endedAt)과
// 세트 시간·휴식이 모두 사라져서, 운동 기록 내보내기의 "한 순서" 정렬(lib/exportData.js)·총 운동 시간·실측 칼로리에서 그 운동이 빠졌다(이름이나 날짜만 고쳐도 마찬가지).
//   · 세 칸을 안 바꿨으면 기존 세트를 그대로 둔다(세트마다 다른 횟수·무게도 유지).
//   · 바꿨으면 입력값으로 균일하게 다시 채우되, 같은 번째 세트의 시각·세트 시간·휴식은 이어받는다.
// initial: 창을 열 때의 { sets, reps, weight } 입력값(문자열 또는 숫자) — 바뀌었는지 비교하는 기준.

export function editedPerformedSets(row, form, initial) {
  const old = Array.isArray(row?.performedSets) ? row.performedSets : []
  const unchanged = old.length > 0 && ['sets', 'reps', 'weight'].every(k => String(form[k] ?? '') === String(initial[k] ?? ''))
  if (unchanged) return old

  const count = Math.max(1, Number(form.sets) || 1)
  const reps = Number(form.reps) || 0
  const weight = Number(form.weight) || 0
  return Array.from({ length: count }, (_, i) => {
    const o = old[i]
    return {
      reps,
      weight,
      durationSeconds: o?.durationSeconds ?? null,
      restBeforeSeconds: o?.restBeforeSeconds ?? null,
      ...(o?.startedAt != null ? { startedAt: o.startedAt, endedAt: o.endedAt ?? null } : {}),
    }
  })
}
