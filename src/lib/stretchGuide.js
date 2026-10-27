// 운동 전 워밍업(동적)·운동 후 스트레칭(정적) — 웹앱·PWA 공용 로직(UI 아님), AI 아닌 규칙.
// 오늘 하는 운동의 근육(muscles)으로 부위별 동작을 골라 보여 준다. 같은 운동이면 항상 같은 결과이고 AI 호출이 없다.
//
// 왜 둘로 나누나: 근육을 오래 늘리는 정적 스트레칭은 운동 직전에 하면 힘이 일시적으로 떨어질 수 있다는 연구가 있어,
// 운동 전에는 몸을 움직이며 데우는 동적 동작(워밍업)을, 운동 후에는 정적 스트레칭을 권한다.
// 한계: 동작 목록·시간·횟수는 일반적인 운동 상식으로 직접 정리한 것이라 전문가 검수를 받은 자료가 아니다 → 화면에 "통증이 있으면 멈추세요"를 표시한다.
// 영상은 담지 않고, 동작 이름으로 유튜브 검색 결과를 연다(lib/exerciseGuide.js의 youtubeHowToUrl).

// 근육 슬러그(lib/muscleMap.js) → 부위 묶음
const REGION_OF = {
  chest: 'chest',
  'upper-back': 'back',
  trapezius: 'back',
  'lower-back': 'lowerBack',
  'front-deltoids': 'shoulder',
  'back-deltoids': 'shoulder',
  biceps: 'arm',
  triceps: 'arm',
  forearm: 'arm',
  abs: 'core',
  obliques: 'core',
  quadriceps: 'quad',
  hamstring: 'ham',
  gluteal: 'glute',
  adductor: 'hip',
  abductors: 'hip',
  calves: 'calf',
}

// 동작: { id, name, how(방법 한 줄), seconds(한 번에 하는 시간), perSide(좌우 따로 하면 true — 한쪽씩 seconds), only(이 근육이 있을 때만) }
const CATCAMEL = { id: 'w-catcamel', name: '고양이-낙타 자세', how: '네발 자세에서 등을 둥글게 말았다가 펴며 천천히 움직여요. 10회.', seconds: 30 }

const WARMUP_GENERAL = { id: 'w-cardio', name: '가벼운 유산소', how: '제자리 걷기나 가볍게 제자리 뛰기로 몸을 데워요.', seconds: 180 }

const WARMUP = {
  chest: [{ id: 'w-chest', name: '팔 벌려 가슴 열기', how: '팔을 옆으로 벌렸다가 앞에서 가볍게 모으며 가슴을 열었다 닫아요. 10회.', seconds: 30 }],
  back: [CATCAMEL],
  lowerBack: [CATCAMEL],
  shoulder: [{ id: 'w-shoulder', name: '어깨 돌리기', how: '양팔을 크게 앞으로 10회, 뒤로 10회 돌려요.', seconds: 30 }],
  arm: [{ id: 'w-arm', name: '손목·팔꿈치 돌리기', how: '손목을 양쪽으로 돌리고 팔꿈치를 굽혔다 폈다 하며 풀어 줘요. 10회씩.', seconds: 30 }],
  core: [{ id: 'w-core', name: '몸통 비틀기', how: '서서 상체를 좌우로 천천히 돌려요. 10회.', seconds: 30 }],
  quad: [{ id: 'w-quad', name: '앞뒤로 다리 흔들기', how: '벽을 짚고 한 다리를 앞뒤로 가볍게 흔들어요. 한쪽 10회.', seconds: 20, perSide: true }],
  ham: [{ id: 'w-ham', name: '인치웜', how: '서서 앞으로 숙여 손으로 바닥을 짚고 걸어 나갔다가 돌아와요. 8회.', seconds: 40 }],
  glute: [{ id: 'w-glute', name: '맨몸 스쿼트', how: '천천히 앉았다 일어나며 엉덩이와 무릎을 깨워 줘요. 10회.', seconds: 30 }],
  hip: [{ id: 'w-hip', name: '옆으로 다리 흔들기', how: '벽을 짚고 한 다리를 옆으로 가볍게 흔들어요. 한쪽 10회.', seconds: 20, perSide: true }],
  calf: [{ id: 'w-calf', name: '발뒤꿈치 들기', how: '발뒤꿈치를 올렸다 내려요. 15회.', seconds: 30 }],
}

const COOLDOWN = {
  chest: [{ id: 'c-chest', name: '문틀 가슴 스트레칭', how: '팔꿈치를 90도로 굽혀 문틀에 대고 몸을 살짝 앞으로 내밀어 가슴을 늘려요.', seconds: 30, perSide: true }],
  back: [{ id: 'c-back', name: '아기 자세', how: '무릎을 꿇고 엉덩이를 뒤꿈치 쪽으로 보내며 팔을 앞으로 뻗어 등을 늘려요.', seconds: 30 }],
  lowerBack: [{ id: 'c-lowerback', name: '무릎 가슴으로 당기기', how: '누워서 한쪽 무릎을 가슴 쪽으로 당겨 안아요. 허리는 바닥에 편안히 둬요.', seconds: 30, perSide: true }],
  shoulder: [{ id: 'c-shoulder', name: '팔 가로질러 어깨 늘리기', how: '한 팔을 가슴 앞으로 가로질러 반대 팔로 당겨요.', seconds: 30, perSide: true }],
  arm: [
    { id: 'c-triceps', name: '팔 머리 뒤로 접기', how: '한 팔을 머리 위로 올려 팔꿈치를 접고 반대 손으로 팔꿈치를 가볍게 눌러요.', seconds: 30, perSide: true, only: ['triceps'] },
    { id: 'c-wrist', name: '손목 앞쪽 늘리기', how: '팔을 앞으로 뻗고 손바닥을 위로 한 채 반대 손으로 손가락을 부드럽게 당겨요.', seconds: 30, perSide: true, only: ['biceps', 'forearm'] },
  ],
  core: [
    { id: 'c-cobra', name: '코브라 자세', how: '엎드려 손으로 바닥을 밀며 가슴을 들어 올려 복부를 늘려요. 허리가 불편하면 낮게 올려요.', seconds: 30, only: ['abs'] },
    { id: 'c-sidebend', name: '옆구리 늘리기', how: '서서 한 팔을 위로 올려 반대쪽으로 몸을 기울여요.', seconds: 30, perSide: true, only: ['obliques'] },
  ],
  quad: [{ id: 'c-quad', name: '서서 허벅지 앞쪽 늘리기', how: '한 발을 뒤로 잡아 엉덩이 쪽으로 당겨요. 균형이 불안하면 벽을 짚어요.', seconds: 30, perSide: true }],
  ham: [{ id: 'c-ham', name: '앉아서 허벅지 뒤쪽 늘리기', how: '한 다리를 펴고 앉아 허리를 둥글게 말지 않고 발끝 쪽으로 숙여요.', seconds: 30, perSide: true }],
  glute: [{ id: 'c-glute', name: '누워서 4자 스트레칭', how: '누워서 한 발목을 반대쪽 무릎 위에 올리고 아래 다리를 가슴 쪽으로 당겨요.', seconds: 30, perSide: true }],
  hip: [{ id: 'c-hip', name: '나비 자세', how: '앉아 발바닥을 맞대고 무릎을 바닥 쪽으로 편안히 내려요.', seconds: 30 }],
  calf: [{ id: 'c-calf', name: '벽 종아리 스트레칭', how: '벽을 짚고 한 다리를 뒤로 뻗어 뒤꿈치를 바닥에 붙인 채 앞무릎을 굽혀요.', seconds: 30, perSide: true }],
}
const COOLDOWN_BREATH = { id: 'c-breath', name: '심호흡', how: '코로 천천히 들이쉬고 입으로 내쉬며 심박을 가라앉혀요.', seconds: 30 }

const MAX_WARMUP = 7 // 가벼운 유산소 포함
const MAX_COOLDOWN = 8 // 마무리 심호흡 제외

// kind: 'warmup' | 'cooldown' / muscles: 오늘 하는 운동들의 근육 슬러그(순서대로, 중복 가능)
// 부위는 처음 나온 순서로 고르고, 너무 많으면 뒤쪽 부위부터 뺀다. 같은 동작(고양이-낙타 등)은 한 번만 넣는다.
export function stretchPlan(kind, muscles = []) {
  const regions = []
  for (const m of muscles) {
    const r = REGION_OF[m]
    if (r && !regions.includes(r)) regions.push(r)
  }
  const table = kind === 'warmup' ? WARMUP : COOLDOWN
  const items = kind === 'warmup' ? [WARMUP_GENERAL] : []
  const seen = new Set(items.map(i => i.id))
  const max = kind === 'warmup' ? MAX_WARMUP : MAX_COOLDOWN
  for (const region of regions) {
    for (const it of table[region] || []) {
      if (items.length >= max) break
      if (it.only && !it.only.some(s => muscles.includes(s))) continue
      if (seen.has(it.id)) continue
      seen.add(it.id)
      items.push(it)
    }
  }
  if (kind === 'cooldown') items.push(COOLDOWN_BREATH)
  return items
}

// 좌우를 따로 하는 동작은 양쪽 시간을 합쳐 센다
export const itemSeconds = it => it.seconds * (it.perSide ? 2 : 1)
export const planMinutes = items => Math.max(1, Math.round(items.reduce((s, it) => s + itemSeconds(it), 0) / 60))
