// 운동 기록(workoutLog) 하나에서 보여줄 값들을 계산하는 공용 함수 모음.
// 완료된 기록은 performedSets(실제로 한 세트들)를 기준으로, 아직 안 한("예정") 기록은
// targetSets/targetReps/targetWeight(루틴에서 정한 목표치)를 기준으로 값을 낸다.

export function setCount(log) {
  return log.performedSets?.length || log.targetSets || 0
}

export function avgReps(log) {
  if (log.performedSets?.length) {
    return Math.round(log.performedSets.reduce((sum, s) => sum + s.reps, 0) / log.performedSets.length)
  }
  return log.targetReps || 0
}

export function avgWeight(log) {
  if (log.performedSets?.length) {
    const avg = log.performedSets.reduce((sum, s) => sum + s.weight, 0) / log.performedSets.length
    return Math.round(avg * 10) / 10
  }
  return log.targetWeight || 0
}

export function totalVolume(log) {
  if (!log.performedSets?.length) return 0
  return log.performedSets.reduce((sum, s) => sum + s.reps * s.weight, 0)
}

// 같은 운동을 과거에 완료한 기록들 중 가장 무거웠던 무게 — 이번 세트가 "얼마나 힘든 강도였는지" 판단 기준.
export function getRecentMaxWeight(logs, exerciseName) {
  const weights = logs
    .filter(l => l.exercise === exerciseName && l.isCompleted && l.performedSets?.length)
    .flatMap(l => l.performedSets.map(s => s.weight))
  return weights.length ? Math.max(...weights) : null
}

const REST_BASELINE_SECONDS = 90

function estimateSetFatigue(set, recentMaxWeight) {
  // 강도: 이번 무게가 최근 최고 무게 대비 얼마나 부담스러운 비중이었는지 (기록 없으면 중간값)
  const intensity = recentMaxWeight ? Math.min(set.weight / recentMaxWeight, 1.2) : 0.7

  // 페이스: 반복당 예상 소요시간(4초)보다 빠르게 끝냈으면 그만큼 힘들었다고 본다
  const expectedSeconds = set.reps * 4
  const paceRatio = set.durationSeconds ? expectedSeconds / set.durationSeconds : 1
  const paceScore = paceRatio > 1 ? Math.min((paceRatio - 1) * 2, 1) : 0

  // 회복 부족: 직전 휴식이 기준(90초)보다 짧았을수록 힘들었다고 본다
  const restRatio = set.restBeforeSeconds != null ? Math.min(set.restBeforeSeconds / REST_BASELINE_SECONDS, 1) : 1
  const restScore = 1 - restRatio

  return intensity * 0.5 + paceScore * 0.25 + restScore * 0.25
}

// 세트별 점수를 평균 내서 1~5 피로도로 환산한다.
export function estimateExerciseFatigue(performedSets, recentMaxWeight) {
  if (!performedSets.length) return 3
  const avgRaw = performedSets.reduce((sum, s) => sum + estimateSetFatigue(s, recentMaxWeight), 0) / performedSets.length
  return Math.min(5, Math.max(1, Math.round(1 + avgRaw * 3.5)))
}
