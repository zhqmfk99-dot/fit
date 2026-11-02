// 운동 기록 하나의 상태 — 웹앱·PWA 공용(UI 아님).
//   완료(isCompleted) / 건너뜀(skipped: 하지 않기로 한 운동, 완료는 아님) / 예정(그 밖의 아직 안 한 운동)
// "아직 할 운동이 남았다"(메인 메뉴의 운동하기 카드, 기록 화면의 시작하기 버튼, 운동 진행 화면)는 **예정**만 센다.
// 건너뜀은 기록에 남아 있다가 기록 화면에서 "다시 하기"로 예정으로 되돌릴 수 있다.
export const isSkipped = l => !!l.skipped && !l.isCompleted
export const isPending = l => !l.isCompleted && !l.skipped