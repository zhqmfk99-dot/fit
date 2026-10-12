// 신체 기록 항목. 그래프에서 고를 수 있는 항목(키 제외)과 자동 계산 로직.
export const BODY_METRICS = [
  { key: 'weightKg', label: '몸무게', unit: 'kg' },
  { key: 'bmi', label: 'BMI', unit: '' },
  { key: 'boneMassKg', label: '뼈 무게', unit: 'kg' },
  { key: 'bodyFatPct', label: '체지방률', unit: '%' },
  { key: 'muscleMassKg', label: '근육량', unit: 'kg' },
  { key: 'musclePct', label: '근육량률', unit: '%' },
  { key: 'proteinPct', label: '단백질', unit: '%' },
  { key: 'waterPct', label: '수분', unit: '%' },
  { key: 'skeletalMuscleKg', label: '골격근', unit: 'kg' },
  { key: 'bmr', label: 'BMR', unit: 'kcal' },
]

// BMI = 몸무게(kg) / 키(m)^2
export function calcBmi(heightCm, weightKg) {
  const h = Number(heightCm)
  const w = Number(weightKg)
  if (!h || !w) return null
  return Math.round((w / (h / 100) ** 2) * 10) / 10
}

// BMR(기초대사량, kcal) — Mifflin-St Jeor 공식. 성별·나이는 "내 정보"에서 가져온다.
export function calcBmr(heightCm, weightKg, age, gender) {
  const h = Number(heightCm)
  const w = Number(weightKg)
  const a = Number(age)
  if (!h || !w || !a || (gender !== '남성' && gender !== '여성')) return null
  const base = 10 * w + 6.25 * h - 5 * a
  return Math.round(gender === '남성' ? base + 5 : base - 161)
}
