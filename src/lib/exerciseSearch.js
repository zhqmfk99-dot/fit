// 웹앱 운동 검색 규칙 — 운동 리스트 검색창과 입력 모달의 운동명 자동완성이 같이 쓴다.
// 정식 명칭(name)과 태그(별칭)를 모두 보고, 대소문자·공백은 무시한다. ("랫 풀다운" = "랫풀다운", "bench press" = "Bench Press")
const normalize = s => String(s ?? '').toLowerCase().replace(/\s+/g, '')

// 운동명 → 태그 목록
export function buildTagIndex(exerciseCatalog = []) {
  return new Map(exerciseCatalog.map(e => [e.name, e.tags ?? []]))
}

// 검색어가 이름이나 태그에 들어 있으면 true. 검색어가 비어 있으면 전부 true.
export function matchesQuery(name, tags, query) {
  const q = normalize(query)
  if (!q) return true
  return normalize(name).includes(q) || (tags ?? []).some(t => normalize(t).includes(q))
}

// 이름은 안 맞는데 태그로 걸린 경우, 걸린 태그를 돌려준다 (자동완성에서 "왜 이 운동이 나왔는지" 보여주려는 용도)
export function aliasMatch(name, tags, query) {
  const q = normalize(query)
  if (!q || normalize(name).includes(q)) return null
  return (tags ?? []).find(t => normalize(t).includes(q)) ?? null
}
