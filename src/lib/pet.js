// 펫 키우기 — 웹앱·PWA 공용 로직(UI 아님). 부화·종류 결정·먹이 가격 검증은 서버(supabase/points.sql의 pet_adopt·pet_feed)가 하고,
// 여기서는 단계 계산과 화면 표시용 값만 만든다. 아래 숫자는 SQL과 같아야 한다. 포인트 1P = 경험치 1.

export const HATCH_XP = 20 // 알이 부화하는 경험치(이때 종류가 정해진다)
export const TEEN_XP = 80 // 청소년이 되는 경험치
export const MAX_XP = 200 // 다 자라는 경험치
export const EGG_COST = 50 // 두 번째부터의 알 가격(첫 알은 무료)
export const FEED_AMOUNTS = [5, 10, 20] // 먹이 버튼(포인트)

// 종류별 이모지(아기 → 청소년 → 다 자란). 알은 모두 🥚. 종류는 부화할 때 서버가 정하며 SQL의 species 목록과 같아야 한다.
export const SPECIES = {
  chick: { name: '병아리', stages: ['🐣', '🐥', '🐔'] },
  dragon: { name: '용', stages: ['🦎', '🐊', '🐉'] },
  cat: { name: '고양이', stages: ['🐱', '🐈', '🦁'] },
  fish: { name: '물고기', stages: ['🐟', '🐠', '🐋'] },
}
export const STAGE_NAMES = ['알', '아기', '청소년', '다 자란']
const EGG = '🥚'

// 경험치 → 단계 0(알) 1(아기) 2(청소년) 3(다 자란)
export const stageOf = xp => (xp >= MAX_XP ? 3 : xp >= TEEN_XP ? 2 : xp >= HATCH_XP ? 1 : 0)
const NEXT_AT = [HATCH_XP, TEEN_XP, MAX_XP, null]

// 펫 한 마리의 표시 값. pet: { species, xp } (서버 행)
export function petView(pet) {
  const xp = Math.max(0, Math.min(MAX_XP, Math.floor(Number(pet?.xp) || 0)))
  const stage = stageOf(xp)
  const sp = SPECIES[pet?.species]
  const emoji = stage === 0 ? EGG : sp ? sp.stages[stage - 1] : '❓'
  const from = stage === 0 ? 0 : stage === 1 ? HATCH_XP : stage === 2 ? TEEN_XP : MAX_XP
  const next = NEXT_AT[stage]
  return {
    xp,
    stage,
    emoji,
    stageName: STAGE_NAMES[stage],
    speciesName: sp?.name ?? (stage === 0 ? '알' : '?'),
    complete: stage === 3,
    nextAt: next, // 다음 단계가 되는 경험치(다 자랐으면 null)
    toNext: next == null ? 0 : next - xp, // 다음 단계까지 남은 경험치
    progress: next == null ? 1 : (xp - from) / (next - from), // 지금 단계 안에서의 진행(0~1)
  }
}

// 먹이 버튼 목록. 다 자라는 데 필요한 양을 넘기지 않게 줄이고(서버도 같은 양만 쓴다), 가진 포인트로 못 사는 버튼은 disabled.
export function feedOptions(balance, xp) {
  const room = MAX_XP - Math.max(0, xp)
  if (room <= 0) return []
  const amounts = [...new Set(FEED_AMOUNTS.map(a => Math.min(a, room)))]
  return amounts.map(amount => ({ amount, disabled: amount > balance }))
}

// 서버 오류 → 화면 문구
export function petErrorMessage(e) {
  const m = String(e?.message ?? e ?? '')
  if (m.includes('not_enough_points')) return '포인트가 부족해요.'
  if (m.includes('already_has_pet')) return '이미 키우는 펫이 있어요.'
  if (m.includes('no_pet')) return '키우는 펫이 없어요. 먼저 알을 받아 주세요.'
  if (m.includes('invalid_amount')) return '먹이 양이 올바르지 않아요.'
  return '잠시 후 다시 시도해 주세요.'
}

// 다 키운 펫의 도감 표시: 종류별 마지막 단계 이모지
export const collectionEmoji = pet => SPECIES[pet?.species]?.stages[2] ?? '❓'
