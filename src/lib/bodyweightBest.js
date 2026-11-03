// 내 맨몸 운동 최고 기록 — 웹앱·PWA 공용 로직(UI 아님). 서버 연결이 없는 순수 함수라 Node 테스트에서 바로 불러올 수 있다(aiRoutine.js는 supabase를 불러온다).
//
// 최근 180일에 무게 없이(모든 세트 0kg) 완료한 운동의 한 세트 최대 횟수. AI 루틴 만들기가 풀업을 10개 하라는 식으로
// 사람의 수준보다 높은 맨몸 목표를 내지 않게, 서버가 이 값을 프롬프트에 알리고 상한으로도 쓴다. 운동 이름·횟수만 쓴다(날짜·무게는 보내지 않음).
// ※ 180일은 "반년 안의 기록이면 지금 수준의 참고가 된다"는 가정이다.
import { exerciseSessions } from './exerciseStats.js'

export const BODYWEIGHT_DAYS = 180
export const BODYWEIGHT_BEST_MAX = 20 // 서버의 MAX_BODYWEIGHT_BEST와 같아야 한다

const pad = n => String(n).padStart(2, '0')
const sinceStr = (days, now) => {
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// [{ id, reps }] — 횟수가 많은 순(같으면 id순), 최대 20개
export function buildBodyweightBest(logs, exercises, now = new Date()) {
  const since = sinceStr(BODYWEIGHT_DAYS, now)
  const recent = logs.filter(l => l.date >= since)
  return exercises
    .map(e => {
      const sessions = exerciseSessions(recent, e.name).filter(s => s.bodyweight)
      return { id: e.id, reps: sessions.length ? Math.max(...sessions.map(s => s.topReps)) : 0 }
    })
    .filter(b => b.reps >= 1)
    .sort((a, b) => b.reps - a.reps || a.id.localeCompare(b.id))
    .slice(0, BODYWEIGHT_BEST_MAX)
}
