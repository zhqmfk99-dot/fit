// 운동 메모(기구 세팅·자세 포인트) 규칙 — 웹앱·PWA 공용. UI 아님.
export const NOTE_MAX = 300

// 저장 전에 다듬는다: 문자열이 아니면 빈 문자열, 앞뒤 공백 제거, 최대 길이로 자름(줄바꿈은 그대로 둔다)
export const cleanNote = v => (typeof v === 'string' ? v.trim().slice(0, NOTE_MAX).trim() : '')
