// 웜업 세트 제안 — PWA 운동 진행 화면이 쓴다. 순수 함수만 있다(규칙 기반, AI 아님: 같은 입력이면 항상 같은 결과).
//
// 오늘 첫 복합관절 운동의 본 세트 무게(목표 무게)를 기준으로 가벼운 무게부터 단계적으로 올려 가는 흔한 방식:
//   본 무게의 50% × 8회 → 70% × 5회 → 85% × 3회, 그다음 본 세트.
//   무게는 2.5kg 단위로 반올림하고, 바벨은 빈 봉(20kg)보다 가볍게는 못 하므로 20kg로 올린다.
//   앞 단계보다 5kg 넘게 오르지 않는 단계(가벼운 무게에서 반올림 때문에 같거나 2.5kg만 오르는 경우)와 본 무게 이상이 되는 단계는 뺀다.
//   표시용 제안일 뿐 기록에는 넣지 않는다(웜업 세트를 기록하면 볼륨·피로도·점진 과부하 평가가 흐려진다).
// ※ 50/70/85%, 8/5/3회, 빈 봉 20kg은 흔히 쓰는 값으로 정한 가정이다(아래 상수).

import { BAR_KG } from './plateMath.js'

// 빈 봉 무게는 원판 계산기(lib/plateMath.js)와 같은 값을 쓴다
export { BAR_KG }
const STEP_KG = 2.5
const MIN_GAP_KG = 5
const STEPS = [
  { pct: 0.5, reps: 8 },
  { pct: 0.7, reps: 5 },
  { pct: 0.85, reps: 3 },
]

// workWeight: 본 세트 무게(kg). 반환: [{ weight, reps }, …] — 제안할 게 없으면(맨몸·너무 가벼움) 빈 배열
export function warmupSets(workWeight, { equipment = '' } = {}) {
  const w = Number(workWeight)
  if (!(w > 0)) return []
  const floor = equipment === '바벨' ? BAR_KG : 0
  const out = []
  for (const s of STEPS) {
    const kg = Math.max(floor, Math.round((w * s.pct) / STEP_KG) * STEP_KG)
    if (kg >= w) continue
    if (out.length && kg - out[out.length - 1].weight < MIN_GAP_KG) continue
    out.push({ weight: kg, reps: s.reps })
  }
  return out
}

// 오늘 웜업 세트를 보여 줄 운동: 오늘 목록(순서대로)의 첫 복합관절·무게 있는 운동. 그 운동을 이미 끝냈으면 몸이 데워졌다고 보고 null.
// 건너뛴 운동은 첫 운동으로 치지 않는다. metaOf(log) = 운동 리스트의 정보({ exerciseType })
export function warmupTargetId(sessionLogs, metaOf) {
  const first = sessionLogs.find(l => !l.skipped && Number(l.targetWeight) > 0 && metaOf(l)?.exerciseType === '복합관절')
  return first && !first.isCompleted ? first.id : null
}

// "20kg × 8 → 35kg × 5 → 50kg × 3"
export const warmupText = sets => sets.map(s => `${s.weight}kg × ${s.reps}`).join(' → ')
