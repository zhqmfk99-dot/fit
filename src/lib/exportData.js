// 데이터 내보내기(CSV) — 웹앱·PWA 설정 화면이 같이 쓴다.
// 엑셀에서 한글이 깨지지 않게 파일 맨 앞에 BOM을 붙이고, 쉼표·따옴표·줄바꿈이 들어간 값은 따옴표로 감싼다.

import { BODY_METRICS } from './bodyMetrics.js'
import { sourceLabel } from './bodySource.js'

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
//  - 시각이 없는 운동(직접 입력·바로 완료 처리·시각이 지워진 옛 수정 기록)은 **앱이 가진 순서(루틴의 운동 순서 → 입력 순서) 자리에 그대로** 둔다.
//    시각이 있는 운동끼리만 그 자리들을 서로 바꿔 시각 순으로 채운다. (예전에는 시각 없는 운동을 하루의 맨 뒤로 몰아서, 일부만 수정한 날은 순서가 뒤죽박죽이었다.)
// 그 전에는 같은 날짜를 id(무작위 UUID) 순으로 정렬해서 하루 안의 순서가 뒤섞였다.
export function sortLogsForExport(logs) {
  const byDate = new Map()
  logs.forEach((l, index) => {
    if (!byDate.has(l.date)) byDate.set(l.date, [])
    byDate.get(l.date).push({ l, index, t: startOf(l) })
  })
  const out = []
  for (const date of [...byDate.keys()].sort()) {
    const group = byDate.get(date) // 앱이 가진 순서
    const timed = group.filter(x => x.t != null).sort((a, b) => a.t - b.t || a.index - b.index)
    let k = 0
    for (const x of group) out.push(x.t == null ? x.l : timed[k++].l) // 시각 없는 운동은 제자리, 시각 있는 자리에는 시각 순으로
  }
  return out
}

// 수퍼세트 묶음: 같은 루틴·같은 날짜의 기록을 앱이 가진 순서(루틴의 운동 순서)대로 보고, linkedToNext가 켜진 운동은 바로 다음 운동과 한 묶음이다
// (A→B→C가 이어져 있으면 셋이 한 묶음). 반환: Map(기록 id → 묶음 키). 루틴에 속하지 않은 기록은 묶음이 없다.
// 묶음은 완료 여부와 상관없이 전체 기록으로 판단한다(짝이 아직 안 끝났어도 같은 묶음).
export function supersetGroupKeys(logs) {
  const byGroup = new Map()
  for (const l of logs) {
    if (!l.routineId) continue
    const k = `${l.date}\u0000${l.routineId}`
    if (!byGroup.has(k)) byGroup.set(k, [])
    byGroup.get(k).push(l)
  }
  const keys = new Map()
  for (const [k, arr] of byGroup) {
    let i = 0
    while (i < arr.length) {
      if (!arr[i].linkedToNext || i === arr.length - 1) {
        i++
        continue
      }
      let j = i
      while (j < arr.length - 1 && arr[j].linkedToNext) j++ // 이어진 마지막 운동까지
      for (let m = i; m <= j; m++) keys.set(arr[m].id, `${k}\u0000${i}`)
      i = j + 1
    }
  }
  return keys
}

// 운동 기록: 완료한 운동을 세트 한 줄씩. 피로도·소모 칼로리는 운동 단위 값이라 그 운동의 첫 세트 줄에만 적는다(합계를 낼 때 중복되지 않게).
// "수퍼세트" 열: 같은 날짜 안에서 묶음마다 "수퍼세트 1", "수퍼세트 2"…(내보내는 줄 순서대로 번호), 수퍼세트가 아닌 운동은 비워 둔다.
export function buildLogsCsv(logs, routines) {
  const routineName = id => routines.find(r => r.id === id)?.name ?? ''
  const groupOf = supersetGroupKeys(logs)
  const numbers = new Map() // 날짜 → { 묶음 키 → 번호 }
  const labelOf = l => {
    const g = groupOf.get(l.id)
    if (!g) return ''
    if (!numbers.has(l.date)) numbers.set(l.date, new Map())
    const m = numbers.get(l.date)
    if (!m.has(g)) m.set(g, m.size + 1)
    return `수퍼세트 ${m.get(g)}`
  }
  const rows = [['날짜', '루틴', '운동', '수퍼세트', '세트', '횟수', '무게(kg)', '세트 시간(초)', '휴식(초)', '피로도(1~5, 운동 단위)', '소모 칼로리(kcal, 운동 단위·추정)']]
  sortLogsForExport(logs.filter(isDone))
    .forEach(l => {
      const superset = labelOf(l)
      l.performedSets.forEach((s, i) => {
        rows.push([
          l.date,
          routineName(l.routineId),
          l.exercise,
          superset,
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
  const rows = [['날짜', ...metrics.map(m => (m.unit ? `${m.label}(${m.unit})` : m.label)), '측정 기기']]
  ;[...bodyRecords]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(r => rows.push([r.date, ...metrics.map(m => r[m.key] ?? ''), sourceLabel(r.source)]))
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
