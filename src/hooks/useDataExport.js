import { useState } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { buildLogsCsv, buildBodyCsv, downloadCsv, exportFilename } from '../lib/exportData.js'

// 설정 화면(웹앱·PWA)의 "데이터 내려받기": 운동 기록·신체 기록을 CSV 파일로 내려받는다.
export function useDataExport() {
  const { logs, routines, bodyRecords } = useWorkoutLogs()
  const [message, setMessage] = useState('')
  const logCount = logs.filter(l => l.isCompleted && l.performedSets?.length).reduce((a, l) => a + l.performedSets.length, 0)

  const run = (label, build, empty) => {
    const { csv, count } = build()
    if (count === 0) return setMessage(empty)
    downloadCsv(exportFilename(label), csv)
    setMessage(`${label} ${count}건을 내려받았어요. 엑셀로 열면 한글이 정상으로 보여요.`)
  }
  const exportLogs = () => run('운동기록', () => buildLogsCsv(logs, routines), '내려받을 운동 기록이 없어요.')
  const exportBody = () => run('신체기록', () => buildBodyCsv(bodyRecords), '내려받을 신체 기록이 없어요.')

  return { exportLogs, exportBody, logCount, bodyCount: bodyRecords.length, message }
}
