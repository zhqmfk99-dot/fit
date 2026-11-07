// 데이터 내보내기(CSV) — 웹앱·PWA 설정 화면이 같이 쓴다.
// 엑셀에서 한글이 깨지지 않게 파일 맨 앞에 BOM을 붙이고, 쉼표·따옴표·줄바꿈이 들어간 값은 따옴표로 감싼다.

import { BODY_METRICS } from './bodyMetrics.js'

const csvCell = v => {
  if (v == null) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const toCsv = rows => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'

const isDone = l => l.isCompleted && l.performedSets?.length > 0

// 그 운동을 처음 시작한 시각(ms): 세트별 startedAt 중 가장 이른 값. 시각이 기록되지 않은 운동(직접 입력·가져온 기록)은 null.
const startOf = l => {
  let t = null
  for (const s of l.performedSets ?? []) if (Number.isFinite(s.startedAt)) t = t == null ? s.startedAt : Math.min(t, s.startedAt)
  return t
}

// 같은 날짜 안의 순서를 "내가 실제로 한 순서"로 맞춘다.
//  - 시각이 기록된 운동(운동 진행 화면으로 한 것)은 시작 시각 순(수퍼세트도 각 운동의 첫 세트 시작 순)
//  - 시각이 없는 운동은 앱이 가진 순서(루틴의 운동 순서 → 입력 순서)를 그대로 두고, 시각이 있는 운동 뒤에 둔다
// 예전에는 같은 날짜를 id(무작위 UUID) 순으로 정렬해서 하루 안의 순서가 뒤섞였다.
export function sortLogsForExport(logs) {
  return logs
    .map((l, index) => ({ l, index, t: startOf(l) }))
    .sort((a, b) => {
      if (a.l.date !== b.l.date) return a.l.date.localeCompare(b.l.date)
      if ((a.t == null) !== (b.t == null)) return a.t == null ? 1 : -1
      if (a.t != null && a.t !== b.t) return a.t - b.t
      return a.index - b.index
    })
    .map(x => x.l)
}

// 운동 기록: 완료한 운동을 세트 한 줄씩. 피로도·소모 칼로리는 운동 단위 값이라 그 운동의 첫 세트 줄에만 적는다(합계를 낼 때 중복되지 않게).
export function buildLogsCsv(logs, routines) {
  const routineName = id => routines.find(r => r.id === id)?.name ?? ''
  const rows = [['날짜', '루틴', '운동', '세트', '횟수', '무게(kg)', '세트 시간(초)', '휴식(초)', '피로도(1~5, 운동 단위)', '소모 칼로리(kcal, 운동 단위·추정)']]
  sortLogsForExport(logs.filter(isDone))
    .forEach(l => {
      l.performedSets.forEach((s, i) => {
        rows.push([
          l.date,
          routineName(l.routineId),
          l.exercise,
          i + 1,
          s.reps ?? '',
          s.weight ?? '',
          s.durationSeconds ?? '',
          s.restBeforeSeconds ?? '',
          i === 0 ? (l.fatigue ?? '') : '',
          i === 0 ? (l.kcal ?? '') : '',
        ])
      })
    })
  return { csv: toCsv(rows), count: rows.length - 1 }
}

// 신체 기록: 날짜순, 항목은 신체 추이 그래프와 같은 이름
export function buildBodyCsv(bodyRecords) {
  const metrics = [{ key: 'heightCm', label: '키', unit: 'cm' }, ...BODY_METRICS]
  const rows = [['날짜', ...metrics.map(m => (m.unit ? `${m.label}(${m.unit})` : m.label))]]
  ;[...bodyRecords]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(r => rows.push([r.date, ...metrics.map(m => r[m.key] ?? '')]))
  return { csv: toCsv(rows), count: rows.length - 1 }
}

// 브라우저에서 파일로 내려받기
export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const exportFilename = (label, now = new Date()) => {
  const pad = n => String(n).padStart(2, '0')
  return `${label}_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`
}
