// 운동명 ↔ 부위 매핑은 이제 "운동 리스트" 화면에서 관리하는 마스터 데이터(exerciseCatalog, WorkoutLogsContext)를 쓴다.
// 여기 아래 함수들은 그 카탈로그를 인자로 받아서 조회만 한다.

// 근육 슬러그 → 화면에 보여줄 한글 이름 (react-body-highlighter가 지원하는 전체 부위 기준 —
// 지금 운동 5개에 매핑 안 된 부위를 눌러도 영어로 안 뜨게 전부 채워둔다)
export const MUSCLE_LABELS = {
  trapezius: '승모근',
  'upper-back': '등',
  'lower-back': '허리',
  chest: '가슴',
  biceps: '이두',
  triceps: '삼두',
  forearm: '전완',
  'back-deltoids': '어깨(후면)',
  'front-deltoids': '어깨',
  abs: '복근',
  obliques: '옆구리',
  adductor: '내전근',
  hamstring: '햄스트링',
  quadriceps: '대퇴사두',
  abductors: '외전근',
  calves: '종아리',
  gluteal: '둔근',
  head: '머리',
  neck: '목',
  knees: '무릎',
  'left-soleus': '왼쪽 종아리',
  'right-soleus': '오른쪽 종아리',
}

// 운동 등록 화면에서 실제로 고를 수 있는 부위 목록 — 머리·목·무릎처럼 인체도의 구조용 영역은 뺀다.
// 상체/하체로 나눠서 필터 등에서 행을 분리해 보여줄 때 쓴다.
export const UPPER_BODY_MUSCLES = ['chest', 'upper-back', 'lower-back', 'front-deltoids', 'back-deltoids', 'trapezius', 'biceps', 'triceps', 'forearm', 'abs', 'obliques']
export const LOWER_BODY_MUSCLES = ['quadriceps', 'hamstring', 'gluteal', 'adductor', 'abductors', 'calves']
export const TRAINABLE_MUSCLES = [...UPPER_BODY_MUSCLES, ...LOWER_BODY_MUSCLES]

// 운동 등록 화면에서 고를 수 있는 사용장비 목록
export const EQUIPMENT_OPTIONS = ['바벨', '덤벨', '머신', '케이블', '벤치', '스미스머신', '밴드', '맨몸', '기타']

const FATIGUE_MAX = 5

// 1~5 피로도 단계를 초록→빨강 5단으로
export const FATIGUE_COLORS = ['#bbf7d0', '#4ade80', '#facc15', '#fb923c', '#f87171']

function musclesFor(exerciseName, exerciseCatalog = []) {
  return exerciseCatalog.find(e => e.name === exerciseName)?.muscles || []
}

// 근육 슬러그 → 그 근육을 쓰는 운동명 목록 (역방향 조회, 인체도 클릭 시 볼륨 추이 필터링용)
export function exercisesForMuscle(muscle, exerciseCatalog = []) {
  return exerciseCatalog.filter(e => e.muscles.includes(muscle)).map(e => e.name)
}

// 운동명 입력창 자동완성용 — 운동 리스트(마스터 카탈로그) + 이미 등록된 루틴들에 실제 쓰인 운동명을 합쳐서 후보 목록을 만든다.
// (루틴 쪽 이름도 같이 넣는 이유: 카탈로그에 아직 등록 안 한 운동을 루틴에서 먼저 썼을 수도 있어서)
export function getKnownExerciseNames(routines = [], exerciseCatalog = []) {
  const fromCatalog = exerciseCatalog.map(e => e.name)
  const fromRoutines = routines.flatMap(r => r.exercises.map(e => e.exercise))
  const all = new Set([...fromCatalog, ...fromRoutines])
  return Array.from(all).sort((a, b) => a.localeCompare(b))
}

// 오늘로부터 며칠 지났는지에 따라 가중치를 절반씩 줄인다 — 이 값만큼 지나면 반영 비율이 절반이 된다.
const HALF_LIFE_DAYS = 3
// 이 밑으로 떨어지면 사실상 무시해도 되는 수준이라 계산에서 뺀다 (약 17일 전 기록부터).
const MIN_WEIGHT = 0.02

function daysAgo(dateStr) {
  const logDate = new Date(dateStr)
  logDate.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((today - logDate) / (1000 * 60 * 60 * 24)))
}

function decayWeight(days) {
  return Math.pow(0.5, days / HALF_LIFE_DAYS)
}

// 완료된 기록의 피로도를 근육별로 가중 평균 낸다 — 최근 기록일수록 크게, 오래될수록 서서히 옅게 반영된다.
// (고정된 N일 창이 아니라 매일 자연스럽게 비중이 줄어드는 방식)
export function computeMuscleFatigue(logs, exerciseCatalog = []) {
  const weightedSums = {}
  const weightSums = {}

  logs
    .filter(l => l.isCompleted && l.fatigue != null)
    .forEach(l => {
      const weight = decayWeight(daysAgo(l.date))
      if (weight < MIN_WEIGHT) return
      musclesFor(l.exercise, exerciseCatalog).forEach(muscle => {
        weightedSums[muscle] = (weightedSums[muscle] || 0) + l.fatigue * weight
        weightSums[muscle] = (weightSums[muscle] || 0) + weight
      })
    })

  const result = {}
  Object.keys(weightedSums).forEach(muscle => {
    result[muscle] = Math.min(FATIGUE_MAX, Math.max(1, Math.round(weightedSums[muscle] / weightSums[muscle])))
  })
  return result
}

// react-body-highlighter는 "몇 번 등장했는지"로 색을 정하니(1회째 색, 2회째 색 ...),
// 근육당 피로도 단계 수만큼 같은 근육을 반복 등록해서 그 단계 색이 나오게 만든다.
export function buildHighlighterData(muscleFatigueMap) {
  const data = []
  Object.entries(muscleFatigueMap).forEach(([muscle, level]) => {
    for (let i = 0; i < level; i++) {
      data.push({ name: `${muscle}_${i}`, muscles: [muscle] })
    }
  })
  return data
}
