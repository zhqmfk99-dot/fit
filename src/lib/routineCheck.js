// 루틴 균형 점검 — 웹앱·PWA 공용 로직(UI 아님), AI 아닌 규칙.
// 같은 루틴이면 항상 같은 결과이고 AI 호출이 없어 무료·즉시다. 운동 리스트의 동작 패턴·운동 유형으로만 판단한다.
// 아래 기준 숫자(밀기:당기기 1.5배, 총 25세트 등)는 흔히 쓰는 값으로 정한 가정이다.
// 운동별로 "이 운동이 적절한가"는 이 파일이 아니라 AI 검토(/api/generate-routine의 review 모드)가 맡는다.

const PUSH_PULL_MIN_SETS = 6 // 밀기+당기기 세트가 이보다 적으면 비율을 따지지 않는다
const PUSH_PULL_RATIO = 1.5 // 밀기가 당기기의 이 배수를 넘으면 경고
const PULL_PUSH_RATIO = 2 // 당기기가 밀기의 이 배수를 넘으면 안내(당기기 쏠림은 덜 문제라 느슨하게)
const MAX_TOTAL_SETS = 24
const LOWER_PATTERNS = ['스쿼트', '힌지', '런지']
const FULL_BODY = '전신'
const UPPER = '상체'

// rows: 등록 화면의 운동 행들 / catalog: 운동 리스트 / options.focus: AI 조건의 집중 부위(없으면 생략)
// 반환: [{ level: 'warn' | 'info', text }]
export function checkRoutineBalance(rows, catalog, { focus = [] } = {}) {
  const byName = new Map(catalog.map(e => [e.name, e]))
  const items = rows
    .filter(r => r.exercise?.trim())
    .map(r => ({ name: r.exercise.trim(), sets: Number(r.sets) || 0, meta: byName.get(r.exercise.trim()) }))
  if (!items.length) return []

  const out = []

  // 같은 운동 중복
  const counts = new Map()
  items.forEach(i => counts.set(i.name, (counts.get(i.name) || 0) + 1))
  const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name)
  if (dups.length) out.push({ level: 'warn', text: `같은 운동이 두 번 들어 있어요: ${dups.join(', ')}` })

  const setsOf = pattern => items.filter(i => i.meta?.movementPattern === pattern).reduce((s, i) => s + i.sets, 0)
  const push = setsOf('밀기')
  const pull = setsOf('당기기')

  // 밀기·당기기 균형: 둘 다 있을 때만 비율을 본다(밀기만 하는 날 같은 의도된 구성은 건드리지 않는다)
  if (push > 0 && pull > 0 && push + pull >= PUSH_PULL_MIN_SETS) {
    if (push > pull * PUSH_PULL_RATIO) out.push({ level: 'warn', text: `밀기 ${push}세트 · 당기기 ${pull}세트로 밀기가 많아요. 당기기를 늘리거나 밀기를 줄이면 균형이 좋아져요.` })
    else if (pull > push * PULL_PUSH_RATIO) out.push({ level: 'info', text: `당기기 ${pull}세트 · 밀기 ${push}세트로 당기기가 많아요.` })
  }

  // 전신·상체 루틴이라고 했는데 한쪽이 통째로 빠진 경우(집중 부위를 아는 AI 초안일 때만)
  const wantsFull = focus.includes(FULL_BODY)
  if (wantsFull || focus.includes(UPPER)) {
    if (push > 0 && pull === 0) out.push({ level: 'warn', text: '밀기 운동만 있고 당기기(등·이두) 운동이 없어요.' })
    else if (pull > 0 && push === 0) out.push({ level: 'info', text: '당기기 운동만 있고 밀기(가슴·어깨·삼두) 운동이 없어요.' })
  }
  if (wantsFull && !items.some(i => LOWER_PATTERNS.includes(i.meta?.movementPattern))) {
    out.push({ level: 'warn', text: '전신 루틴인데 하체(스쿼트·힌지·런지) 운동이 없어요.' })
  }

  // 순서: 큰 근육을 쓰는 복합관절 운동 뒤에 단관절 운동이 오는 게 일반적이다
  const firstCompound = items.findIndex(i => i.meta?.exerciseType === '복합관절')
  const firstIsolation = items.findIndex(i => i.meta?.exerciseType === '단관절' && i.meta?.movementPattern !== '코어')
  if (firstCompound !== -1 && firstIsolation !== -1 && firstIsolation < firstCompound) {
    out.push({ level: 'info', text: '단관절(고립) 운동이 복합관절 운동보다 앞에 있어요. 복합관절 운동을 앞에 두면 힘이 남았을 때 할 수 있어요.' })
  }

  // 총 세트 수
  const total = items.reduce((s, i) => s + i.sets, 0)
  if (total > MAX_TOTAL_SETS) out.push({ level: 'warn', text: `총 ${total}세트로 많은 편이에요(보통 ${MAX_TOTAL_SETS}세트 이하). 끝까지 집중하기 어려울 수 있어요.` })

  return out
}
