// 원판 계산기 — PWA 운동 진행 화면(바벨 운동)이 쓴다. 순수 함수만 있다.
//
// 총 무게(봉 포함)에서 봉 무게를 빼고 둘로 나눈 값을 한쪽에 끼울 원판으로 맞춘다(큰 원판부터 채우는 방식).
//   원판 구성은 흔한 체육관 기준(25·20·15·10·5·2.5·1.25kg)이고 봉은 20kg이다 — 우리 체육관과 다르면 맞지 않을 수 있다.
//   1.25kg 단위로 맞출 수 없는 무게(예: 총 61kg)는 가장 가까운 아래 무게로 맞추고 모자라는 만큼을 알려 준다.

export const BAR_KG = 20
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

const MILLI = 1000 // 부동소수점 오차를 피하려고 0.001kg 정수로 계산한다

// total: 총 무게(kg, 봉 포함)
// 반환: { kind: 'invalid' | 'light' | 'bar' | 'plates', perSide: [{ plate, count }], exact, shortKg }
//   shortKg: 원판으로 못 맞춘 총 무게(kg, 양쪽 합)
export function platesPerSide(total, { bar = BAR_KG, plates = PLATES_KG } = {}) {
  const t = Number(total)
  if (!(t > 0) || !(bar > 0)) return { kind: 'invalid', perSide: [], exact: false, shortKg: 0 }
  if (t < bar) return { kind: 'light', perSide: [], exact: false, shortKg: 0 }
  let left = Math.floor(((t - bar) / 2) * MILLI + 1e-6) // 모자라게 맞추므로 내림
  if (left === 0) return { kind: 'bar', perSide: [], exact: true, shortKg: 0 }
  const perSide = []
  for (const p of [...plates].sort((a, b) => b - a)) {
    const unit = Math.round(p * MILLI)
    const count = Math.floor(left / unit)
    if (count > 0) {
      perSide.push({ plate: p, count })
      left -= count * unit
    }
  }
  return { kind: 'plates', perSide, exact: left === 0, shortKg: Math.round(((left * 2) / MILLI) * 100) / 100 }
}

// "25×2 + 10 + 2.5" (한쪽)
export const platesText = perSide => perSide.map(p => (p.count > 1 ? `${p.plate}×${p.count}` : `${p.plate}`)).join(' + ')
