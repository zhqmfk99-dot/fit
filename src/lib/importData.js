// 과거 운동 기록 가져오기(CSV·표 붙여넣기) — 웹앱·PWA 설정 화면이 같이 쓴다. 순수 함수만 있다(UI·저장소 의존 없음).
//
// 읽을 수 있는 형식은 이 앱의 "운동 기록 내려받기" CSV와 같은 열이다(다른 도구에서 만든 표도 열 이름만 맞으면 된다):
//   필수: 날짜, 운동, 횟수  /  선택: 세트(번호), 무게(kg), 세트 시간(초), 휴식(초), 피로도(1~5), 루틴
//   무게 열이 없으면 모두 맨몸(0kg)으로 본다(미리보기에 경고). 소모 칼로리 열은 무시한다(앱이 지금 체중·보정 계수로 다시 계산한다).
//   구분자는 쉼표·탭(엑셀·구글 시트에서 복사)·세미콜론을 알아서 구분한다. 날짜는 2026-03-05 · 2026/3/5 · 2026.3.5 형식.
// 같은 날짜·같은 운동의 줄들은 기록 하나(세트 여러 개)로 묶는다. 이미 완료한 같은 날짜·같은 운동 기록이 있으면 중복이라 건너뛴다(여러 번 가져와도 안전).
// 운동 이름은 운동 리스트의 이름·태그(별칭)와 맞춰 보고, 없으면 적은 그대로 둔다(운동 리스트에 없는 운동은 부위·근육 통계에서 빠진다).
// 가져온 기록은 루틴과 연결하지 않는다(routineId 없음). 점진 과부하·개인 기록·추이 계산에는 운동 이름으로 쓰인다.

import { estimateExerciseFatigue } from './workoutMetrics.js'

export const IMPORT_MAX_ROWS = 5000
const MAX_REPS = 500
const MAX_WEIGHT = 1000
const MAX_ERRORS_SHOWN = 20

// ── CSV 읽기 ──────────────────────────────────────────────
// 따옴표로 감싼 값(안의 쉼표·줄바꿈·"" 이스케이프)을 지원한다. 맨 앞 BOM은 지운다. 구분자는 첫 줄에서 가장 많은 것으로 정한다.
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const firstLine = src.split('\n').find(l => l.trim()) ?? ''
  const count = ch => firstLine.split(ch).length - 1
  const delimiter = count('\t') > count(',') && count('\t') >= count(';') ? '\t' : count(';') > count(',') ? ';' : ','
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += c
    } else if (c === '"' && cell === '') quoted = true
    else if (c === delimiter) {
      row.push(cell)
      cell = ''
    } else if (c === '\n') {
      row.push(cell)
      cell = ''
      if (row.some(v => v.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some(v => v.trim() !== '')) rows.push(row)
  return { rows, delimiter }
}

// ── 열 이름 ──────────────────────────────────────────────
const headKey = s => String(s ?? '').trim().toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, '')
const ALIASES = {
  date: ['날짜', '일자', 'date', 'day'],
  exercise: ['운동', '운동명', '종목', 'exercise', 'name'],
  set: ['세트', '세트번호', 'set', 'setno'],
  reps: ['횟수', '반복', '회수', 'reps', 'rep'],
  weight: ['무게', '중량', 'weight', 'kg'],
  duration: ['세트시간', 'duration'],
  rest: ['휴식', 'rest'],
  fatigue: ['피로도', 'fatigue'],
  routine: ['루틴', 'routine'],
}
function mapColumns(header) {
  const idx = {}
  header.forEach((h, i) => {
    const k = headKey(h)
    for (const [field, names] of Object.entries(ALIASES)) if (idx[field] == null && names.includes(k)) idx[field] = i
  })
  return idx
}

// ── 값 읽기 ──────────────────────────────────────────────
const isRealDate = (y, m, d) => {
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}
export function normalizeDate(v) {
  const m = String(v ?? '').trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/)
  if (!m) return null
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  return isRealDate(y, mo, d) ? `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null
}
const num = v => {
  const s = String(v ?? '').trim().replace(/kg$/i, '').replace(/회$/, '').replace(/초$/, '').replace(',', '.').trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

const squash = s => String(s ?? '').toLowerCase().replace(/\s+/g, '')
// 운동 리스트의 이름·태그와 맞춰 본 정식 이름(없으면 null)
export function resolveExerciseName(raw, catalog) {
  const k = squash(raw)
  if (!k) return null
  const byName = catalog.find(e => squash(e.name) === k)
  if (byName) return byName.name
  const byTag = catalog.find(e => (e.tags ?? []).some(t => squash(t) === k))
  return byTag ? byTag.name : null
}

const mode = (values, tieBreakHigh = true) => {
  const c = new Map()
  values.forEach(v => c.set(v, (c.get(v) || 0) + 1))
  return [...c.entries()].sort((a, b) => b[1] - a[1] || (tieBreakHigh ? b[0] - a[0] : a[0] - b[0]))[0][0]
}

// text: CSV·붙여넣은 표 / exercises: 운동 리스트 / existingLogs: 지금 있는 기록 / today: 'YYYY-MM-DD'
// 반환: { headerError, logs: [새 기록 객체], stats: { rows, groups, sets, from, to, duplicates, unknown: [이름], errorCount, errors: [{ line, message }], weightMissing, delimiter } }
export function parseLogsCsv(text, { exercises = [], existingLogs = [], today, newId = () => crypto.randomUUID() } = {}) {
  const stats = { rows: 0, groups: 0, sets: 0, from: null, to: null, duplicates: 0, unknown: [], errorCount: 0, errors: [], weightMissing: false, delimiter: ',' }
  const fail = headerError => ({ headerError, logs: [], stats })
  const { rows, delimiter } = parseCsv(text)
  stats.delimiter = delimiter
  if (rows.length === 0) return fail('붙여넣은 내용이 비어 있어요.')
  const cols = mapColumns(rows[0])
  const missing = [['date', '날짜'], ['exercise', '운동'], ['reps', '횟수']].filter(([f]) => cols[f] == null).map(([, n]) => n)
  if (missing.length) return fail(`첫 줄에서 필수 열을 찾지 못했어요: ${missing.join(', ')}. 첫 줄은 열 이름이어야 해요(예: 날짜,운동,세트,횟수,무게(kg)).`)
  const body = rows.slice(1)
  if (body.length === 0) return fail('열 이름 아래에 기록이 없어요.')
  if (body.length > IMPORT_MAX_ROWS) return fail(`한 번에 ${IMPORT_MAX_ROWS.toLocaleString()}줄까지만 가져올 수 있어요(지금 ${body.length.toLocaleString()}줄). 나눠서 가져와 주세요.`)
  stats.rows = body.length
  stats.weightMissing = cols.weight == null

  const addError = (line, message) => {
    stats.errorCount++
    if (stats.errors.length < MAX_ERRORS_SHOWN) stats.errors.push({ line, message })
  }

  const groups = new Map() // key → { date, exercise, sets: [{ no, order, reps, weight, durationSeconds, restBeforeSeconds }], fatigue }
  const unknown = new Set()
  body.forEach((r, i) => {
    const line = i + 2 // 첫 줄이 열 이름이라 기록은 2번째 줄부터
    const cell = f => (cols[f] == null ? '' : r[cols[f]] ?? '')
    const date = normalizeDate(cell('date'))
    if (!date) return addError(line, `날짜를 읽지 못했어요("${String(cell('date')).trim()}"). 2026-03-05 형식으로 적어 주세요.`)
    if (today && date > today) return addError(line, `${date}은 오늘 이후라 가져올 수 없어요.`)
    const rawName = String(cell('exercise')).trim()
    if (!rawName) return addError(line, '운동 이름이 비어 있어요.')
    if (rawName.length > 60) return addError(line, '운동 이름이 너무 길어요(60자까지).')
    const reps = num(cell('reps'))
    if (reps == null || Number.isNaN(reps) || !Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) return addError(line, `횟수는 1~${MAX_REPS} 사이의 정수여야 해요("${String(cell('reps')).trim()}").`)
    const w = num(cell('weight'))
    if (Number.isNaN(w) || (w != null && (w < 0 || w > MAX_WEIGHT))) return addError(line, `무게는 0~${MAX_WEIGHT}kg 사이의 숫자여야 해요("${String(cell('weight')).trim()}").`)
    const setNo = num(cell('set'))
    const dur = num(cell('duration'))
    const rest = num(cell('rest'))
    const fat = num(cell('fatigue'))

    const resolved = resolveExerciseName(rawName, exercises)
    const exercise = resolved ?? rawName
    if (!resolved) unknown.add(rawName)
    const key = `${date}\u0000${exercise}`
    if (!groups.has(key)) groups.set(key, { date, exercise, sets: [], fatigue: null })
    const g = groups.get(key)
    g.sets.push({
      no: setNo != null && !Number.isNaN(setNo) ? setNo : null,
      order: g.sets.length,
      reps,
      weight: w ?? 0,
      durationSeconds: dur != null && !Number.isNaN(dur) && dur >= 0 ? Math.round(dur) : null,
      restBeforeSeconds: rest != null && !Number.isNaN(rest) && rest >= 0 ? Math.round(rest) : null,
    })
    if (g.fatigue == null && fat != null && Number.isInteger(fat) && fat >= 1 && fat <= 5) g.fatigue = fat
  })

  // 이미 완료한 같은 날짜·같은 운동 기록이 있으면 건너뛴다
  const have = new Set(existingLogs.filter(l => l.isCompleted && l.performedSets?.length).map(l => `${l.date}\u0000${l.exercise}`))
  const kept = []
  for (const [key, g] of groups) {
    if (have.has(key)) stats.duplicates++
    else kept.push(g)
  }
  kept.sort((a, b) => a.date.localeCompare(b.date) || a.exercise.localeCompare(b.exercise, 'ko'))

  // 피로도 추정용 "그때까지의 최고 무게": 기존 완료 기록 + 가져오는 기록 중 그 날짜 이전(당일 포함)의 같은 운동
  const history = [
    ...existingLogs.filter(l => l.isCompleted && l.performedSets?.length).map(l => ({ date: l.date, exercise: l.exercise, max: Math.max(...l.performedSets.map(s => Number(s.weight) || 0)) })),
    ...kept.map(g => ({ date: g.date, exercise: g.exercise, max: Math.max(...g.sets.map(s => s.weight)) })),
  ]

  const logs = kept.map(g => {
    const ordered = [...g.sets].sort((a, b) => (a.no != null && b.no != null ? a.no - b.no : 0) || a.order - b.order)
    const performedSets = ordered.map(s => ({ reps: s.reps, weight: s.weight, durationSeconds: s.durationSeconds, restBeforeSeconds: s.restBeforeSeconds }))
    const priorMax = Math.max(0, ...history.filter(h => h.exercise === g.exercise && h.date <= g.date).map(h => h.max))
    return {
      id: newId(),
      date: g.date,
      exercise: g.exercise,
      targetSets: performedSets.length,
      targetReps: mode(performedSets.map(s => s.reps)),
      targetWeight: mode(performedSets.map(s => s.weight)),
      linkedToNext: false,
      performedSets,
      fatigue: g.fatigue ?? estimateExerciseFatigue(performedSets, priorMax > 0 ? priorMax : null),
      isCompleted: true,
      kcal: null, // 저장할 때 앱이 지금 체중·보정 계수로 채운다
      skipped: false,
    }
  })

  stats.groups = logs.length
  stats.sets = logs.reduce((a, l) => a + l.performedSets.length, 0)
  stats.from = logs[0]?.date ?? null
  stats.to = logs[logs.length - 1]?.date ?? null
  stats.unknown = [...unknown].filter(n => kept.some(g => g.exercise === n)).sort((a, b) => a.localeCompare(b, 'ko'))
  return { headerError: null, logs, stats }
}
