// 총 운동 시간 — 웹앱·PWA 공용.
// 운동 진행 화면이 세트마다 시작·종료 시각(startedAt/endedAt, ms)을 workout_logs.performed_sets에 저장한다.
// 하루 총 시간 = 그날 완료한 세트들의 [시작, 종료] 구간을 합친 길이.
// 세트 사이 휴식·운동 사이 이동은 간격이 MAX_GAP_SECONDS 이하면 운동 시간에 포함하고, 그보다 길면(중간에 쉬었다 다시 시작) 뺀다.
// 시각이 저장되지 않은 기록(이 기능 이전, 직접 입력)은 계산에서 빠지며, 시각이 하나도 없으면 null.

const MAX_GAP_SECONDS = 15 * 60

export function dayDurationSeconds(date, logs) {
  const spans = []
  for (const l of logs) {
    if (l.date !== date || !l.isCompleted) continue
    for (const s of l.performedSets || []) {
      if (s.startedAt != null && s.endedAt != null && s.endedAt >= s.startedAt) spans.push([s.startedAt, s.endedAt])
    }
  }
  if (!spans.length) return null
  spans.sort((a, b) => a[0] - b[0])
  let total = 0
  let [curStart, curEnd] = spans[0]
  for (const [st, en] of spans.slice(1)) {
    if (st - curEnd <= MAX_GAP_SECONDS * 1000) {
      curEnd = Math.max(curEnd, en)
    } else {
      total += curEnd - curStart
      ;[curStart, curEnd] = [st, en]
    }
  }
  total += curEnd - curStart
  return Math.round(total / 1000)
}

// 3725 → "1시간 2분", 1500 → "25분", 40 → "1분 미만"
export function formatDuration(seconds) {
  if (seconds == null) return ''
  const m = Math.round(seconds / 60)
  if (m < 1) return '1분 미만'
  const h = Math.floor(m / 60)
  return h ? (m % 60 ? `${h}시간 ${m % 60}분` : `${h}시간`) : `${m}분`
}
