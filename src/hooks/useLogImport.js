import { useState } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { parseLogsCsv } from '../lib/importData.js'
import { todayStr } from '../lib/bodyGoal.js'

const MAX_FILE_BYTES = 2 * 1024 * 1024 // 2MB — 텍스트 기록 5,000줄보다 훨씬 크다

// 설정 화면(웹앱·PWA)의 "운동 기록 가져오기": CSV 파일·붙여넣은 표 → 미리보기 → 가져오기. 읽기 규칙은 lib/importData.js.
export function useLogImport() {
  const { logs, setLogs, exercises } = useWorkoutLogs()
  const [text, setTextState] = useState('')
  const [preview, setPreview] = useState(null) // parseLogsCsv 결과
  const [done, setDone] = useState(null) // { groups, sets } — 가져오기를 마친 뒤 안내
  const [fileError, setFileError] = useState('')

  const parse = () => parseLogsCsv(text, { exercises, existingLogs: logs, today: todayStr() })

  const setText = v => {
    setTextState(v)
    setPreview(null) // 내용이 바뀌면 미리보기는 다시 만든다
    setDone(null)
  }

  const loadFile = async file => {
    setFileError('')
    if (!file) return
    if (file.size > MAX_FILE_BYTES) return setFileError('파일이 너무 커요(2MB까지). 나눠서 가져와 주세요.')
    try {
      setText(await file.text())
    } catch {
      setFileError('파일을 읽지 못했어요.')
    }
  }

  const runPreview = () => {
    setDone(null)
    setPreview(parse())
  }

  // 가져오기 직전에 다시 읽는다(미리보기 뒤에 기록이 바뀌었을 수 있어서 — 중복 판정을 최신 기록으로 한다)
  const commit = () => {
    const fresh = parse()
    if (fresh.headerError || fresh.logs.length === 0) return setPreview(fresh)
    setLogs(prev => [...fresh.logs, ...prev]) // 저장 시 소모 칼로리는 앱이 지금 체중·보정 계수로 채운다
    setDone({ groups: fresh.stats.groups, sets: fresh.stats.sets })
    setPreview(null)
    setTextState('')
  }

  return { text, setText, loadFile, fileError, preview, runPreview, commit, done }
}
