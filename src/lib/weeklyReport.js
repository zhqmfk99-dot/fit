// 주간 리포트 — 최근 7일(오늘 포함)을 그 전 7일과 비교한다. 웹앱·PWA 대시보드가 같이 쓰는 계산(UI 아님).
// AI가 아니라 규칙이다: 같은 기록이면 항상 같은 결과이고, 문장은 아래 규칙에서 바로 만든다.

import { dayDurationSeconds } from './workoutTime.js'

export const PERIOD_DAYS = 7

// 근육 슬러그 → 보기 쉬운 6개 부위 묶음
const GROUP_OF = {
  chest: '가슴',
  'upper-back': '등',
  'lower-back': '등',
  trapezius: '등',
  'front-deltoids': '어깨',
  'back-deltoids': '어깨',
  biceps: '팔',
  triceps: '팔',
  forearm: '팔',
  quadriceps: '하체',
  hamstring: '하체',
  gluteal: '하체',
  calves: '하체',
  adductor: '하체',
  abductors: '하체',
  abs: '코어',
  obliques: '코어',
}
export const GROUP_LABELS = ['가슴', '등', '어깨', '팔', '하체', '코어']

const pad = n => String(n).padStart(2, '0')
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n, from) => {
  const d = new Date(from)
  d.setDate(d.getDate() - n)
  return dateStr(d)
}
const isDone = l => l.isCompleted && l.performedSets?.length > 0
const maxWeight = l => Math.max(0, ...l.performedSets.map(s => s.weight || 0))

// 한 기간(from~to 날짜 문자열, 양끝 포함)의 요약
function summarizePeriod(logs, exercises, from, to) {
  const inRange = logs.filter(l => isDone(l) && l.date >= from && l.date <= to)
  const dates = [...new Set(inRange.map(l => l.date))]
  const byName = new Map(exercises.map(e => [e.name, e]))

  let sets = 0
  let volume = 0
  let kcal = 0
  const groupSets = Object.fromEntries(GROUP_LABELS.map(g => [g, 0]))
  const maxByExercise = new Map()
  for (const l of inRange) {
    const n = l.performedSets.length
    sets += n
    volume += l.performedSets.reduce((a, s) => a + (s.reps || 0) * (s.weight || 0), 0)
    kcal += l.kcal || 0
    const groups = new Set((byName.get(l.exercise)?.muscles || []).map(m => GROUP_OF[m]).filter(Boolean))
    groups.forEach(g => (groupSets[g] += n))
    maxByExercise.set(l.exercise, Math.max(maxByExercise.get(l.exercise) || 0, maxWeight(l)))
  }
  // 총 운동 시간: 날짜별로 시각이 기록된 세트만 합산(시각이 없는 기록은 빠진다 — 하나도 없으면 null)
  const durations = dates.map(d => dayDurationSeconds(d, logs)).filter(v => v != null)
  return {
    sessions: dates.length,
    exerciseCount: inRange.length,
    sets,
    volume: Math.round(volume),
    kcal: Math.round(kcal),
    seconds: durations.length ? durations.reduce((a, b) => a + b, 0) : null,
    groupSets,
    maxByExercise,
  }
}

const fmtKg = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10))

// 이번 7일 요약 + 지난 7일과의 비교 + 하이라이트 문장
export function buildWeeklyReport(logs, exercises, now = new Date()) {
  const thisFrom = daysAgo(PERIOD_DAYS - 1, now)
  const thisTo = dateStr(now)
  const prevFrom = daysAgo(PERIOD_DAYS * 2 - 1, now)
  const prevTo = daysAgo(PERIOD_DAYS, now)

  const cur = summarizePeriod(logs, exercises, thisFrom, thisTo)
  const prev = summarizePeriod(logs, exercises, prevFrom, prevTo)
  const empty = cur.sessions === 0

  const highlights = []
  if (!empty) {
    // 운동한 날
    const dd = cur.sessions - prev.sessions
    if (prev.sessions > 0 && dd !== 0) highlights.push({ kind: dd > 0 ? 'up' : 'down', text: `운동한 날이 지난주보다 ${Math.abs(dd)}일 ${dd > 0 ? '늘었어요' : '줄었어요'} (${prev.sessions}일 → ${cur.sessions}일)` })

    // 볼륨
    if (prev.volume > 0 && cur.volume > 0) {
      const pct = Math.round(((cur.volume - prev.volume) / prev.volume) * 100)
      if (Math.abs(pct) >= 5) highlights.push({ kind: pct > 0 ? 'up' : 'down', text: `총 볼륨이 지난주보다 ${Math.abs(pct)}% ${pct > 0 ? '늘었어요' : '줄었어요'}` })
    }

    // 최고 무게 갱신: 이 기간의 최고 무게가, 이 기간 이전 전체 기록의 최고 무게를 넘은 운동
    const before = logs.filter(l => isDone(l) && l.date < thisFrom)
    const records = []
    for (const [name, w] of cur.maxByExercise) {
      if (w <= 0) continue
      const prior = Math.max(0, ...before.filter(l => l.exercise === name).map(maxWeight))
      if (prior > 0 && w > prior) records.push({ name, w, delta: w - prior })
    }
    records.sort((a, b) => b.delta - a.delta)
    records.slice(0, 3).forEach(r => highlights.push({ kind: 'record', text: `${r.name} 최고 무게 갱신 — ${fmtKg(r.w)}kg (+${fmtKg(r.delta)}kg)` }))

    // 안 한 부위: 운동한 날이 2일 이상일 때만 판단(하루 운동으로 "빠졌다"고 말하면 과하다)
    if (cur.sessions >= 2) {
      const missed = GROUP_LABELS.filter(g => cur.groupSets[g] === 0)
      if (missed.length && missed.length < GROUP_LABELS.length) highlights.push({ kind: 'warn', text: `이번 주에 안 한 부위: ${missed.join(', ')}` })
    }
  }

  return {
    empty,
    period: { from: thisFrom, to: thisTo },
    cur,
    prev,
    groups: GROUP_LABELS.map(label => ({ label, sets: cur.groupSets[label], prevSets: prev.groupSets[label] })),
    highlights,
  }
}
