// 이 운동을 마지막으로 했을 때의 무게(없으면 null). 목표 무게가 있으면 그것, 없으면 수행한 세트의 최대 무게.
// (순수 함수라 서버 연결 없이 쓸 수 있도록 aiRoutine.js에서 따로 뺐다 — aiRoutine.js가 그대로 다시 내보낸다)
export function lastWeightFor(exerciseName, logs) {
  const done = logs
    .filter(l => l.exercise === exerciseName && l.isCompleted && l.performedSets?.length)
    .sort((a, b) => b.date.localeCompare(a.date))
  const last = done[0]
  if (!last) return null
  const w = last.targetWeight || Math.max(...last.performedSets.map(s => s.weight || 0))
  return w > 0 ? w : null
}