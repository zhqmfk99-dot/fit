import assert from 'node:assert/strict'
process.env.GEMINI_API_KEY = 'k'
process.env.VITE_SUPABASE_URL = 'http://sb.test'
process.env.VITE_SUPABASE_ANON_KEY = 'a'
const { default: handler } = await import('../api/generate-routine.js')

let geminiText = ''
let rpcMode = 'ok'
const rpcCalls = []
let liveUsage = false
let geminiQueue = []
let geminiCalls = 0
let finish = 'STOP'
let usageCount = 0
let lastGeminiBody = null
const recorded = []
globalThis.fetch = async (url, opts = {}) => {
  url = String(url)
  if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: 'u1' }), { status: 200 })
  if (url.includes('/rest/v1/rpc/consume_ai_usage')) {
    const body = JSON.parse(opts.body)
    rpcCalls.push(body)
    if (rpcMode === 'missing') return new Response(JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.consume_ai_usage' }), { status: 404 })
    if (rpcMode === 'denied') return new Response(JSON.stringify({ code: '42501', message: 'permission denied' }), { status: 403 })
    if (rpcMode === 'garbage') return new Response('"abc"', { status: 200 })
    // 실제 DB 함수처럼: 한도 확인과 기록이 한 번에(끊어지지 않게) 일어난다
    if (usageCount >= body.p_limit) return new Response('-1', { status: 200 })
    recorded.push(body.p_kind)
    const left = body.p_limit - usageCount - 1
    if (liveUsage) usageCount++
    return new Response(String(left), { status: 200 })
  }
  if (url.includes('/rest/v1/ai_usage') && (opts.method || 'GET') === 'GET') {
    return new Response('[]', { status: 200, headers: { 'content-range': `0-0/${usageCount}` } })
  }
  if (url.includes('/rest/v1/ai_usage')) { recorded.push(JSON.parse(opts.body).kind); if (liveUsage) usageCount++; return new Response(null, { status: 201 }) }
  if (url.includes('generativelanguage')) {
    lastGeminiBody = JSON.parse(opts.body)
    geminiCalls++
    const text = geminiQueue.length ? geminiQueue.shift() : geminiText
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: finish }] }), { status: 200 })
  }
  throw new Error('unexpected ' + url)
}

const run = async body => {
  const out = { status: 200, json: null }
  const res = { status(c) { out.status = c; return res }, json(o) { out.json = o; return res } }
  await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res)
  return out
}

const catalog = [
  { id: 'a', name: '벤치프레스', muscles: ['가슴', '삼두'], equipment: '바벨', pattern: '밀기', type: '복합관절' },
  { id: 'b', name: '크런치', muscles: ['복근'], equipment: '맨몸', pattern: '코어', type: '단관절' },
  { id: 'c', name: '플랭크', muscles: ['복근'], equipment: '맨몸', pattern: '코어', type: '단관절' },
  { id: 'd', name: '케이블 크런치', muscles: ['복근'], equipment: '케이블', pattern: '코어', type: '단관절' },
  { id: 'e', name: '레그레이즈', muscles: ['복근'], equipment: '맨몸', pattern: '코어', type: '단관절' },
]
const base = { review: true, goal: '근비대', level: '초보', focus: ['코어'], exercises: catalog, current: [{ id: 'a', sets: 3, reps: 8, restSeconds: 90 }, { id: 'b', sets: 3, reps: 15, restSeconds: 60 }] }

// 1. 정상 + 검증: 목록 밖 id/현재 루틴 id/중복 대체/good의 대체는 걸러짐, 순서는 루틴 순서
geminiText = JSON.stringify({
  overall: '밀기 위주예요.',
  items: [
    { id: 'b', verdict: 'poor', reason: '이유', alternatives: [{ id: 'c', reason: 'r1' }, { id: 'c', reason: '중복' }, { id: 'zzz', reason: '목록 밖' }, { id: 'a', reason: '현재 루틴' }, { id: 'e', reason: 'r2' }, { id: 'd', reason: '3번째' }] },
    { id: 'a', verdict: 'good', reason: '좋음', alternatives: [{ id: 'c', reason: '붙으면 안 됨' }] },
    { id: 'nope', verdict: 'good', reason: '현재 루틴에 없음', alternatives: [] },
    { id: 'a', verdict: 'poor', reason: '같은 운동 두 번', alternatives: [] },
  ],
})
let r = await run(base)
assert.equal(r.status, 200)
assert.deepEqual(r.json.items.map(i => i.id), ['a', 'b'])
assert.equal(r.json.items[0].verdict, 'good')
assert.deepEqual(r.json.items[0].alternatives, [])
assert.deepEqual(r.json.items[1].alternatives.map(a => a.id), ['c', 'e'])
assert.equal(r.json.remaining, 19)
assert.deepEqual(recorded, ['review'])
// 요청이 검토 프롬프트로 갔는지(운동 목록에서 현재 루틴 제외, 조건 포함)
const prompt = lastGeminiBody.contents[0].parts[0].text
assert.match(lastGeminiBody.systemInstruction.parts[0].text, /검토하는 보조자/)
assert.match(prompt, /목표: 근비대/)
assert.match(prompt, /\[현재 루틴\][\s\S]*E1 \| 벤치프레스[\s\S]*3×8/)
assert.ok(!/\[사용 가능한 운동 목록[^\n]*\n(?:.*\n)*E1 \| 벤치프레스/.test(prompt), '현재 루틴 운동이 대체 목록에 또 나옴')
assert.equal(lastGeminiBody.generationConfig.responseSchema.properties.items.items.properties.verdict.enum.length, 3)

// 2. 목표·경력·집중 부위 없이도 동작("지정 안 함")
geminiText = JSON.stringify({ overall: 'x', items: [{ id: 'a', verdict: 'ok', reason: 'r', alternatives: [] }] })
r = await run({ ...base, goal: undefined, level: 'zzz', focus: undefined })
assert.equal(r.status, 200)
assert.match(lastGeminiBody.contents[0].parts[0].text, /목표: 지정 안 함[\s\S]*경력: 지정 안 함[\s\S]*집중 부위: 지정 안 함/)

// 3. 잘못된 입력: 현재 루틴 없음 / 목록 밖 id만 / 후보 3개 미만 → 400
assert.equal((await run({ ...base, current: [] })).status, 400)
assert.equal((await run({ ...base, current: [{ id: 'zzz' }] })).status, 400)
assert.equal((await run({ ...base, exercises: catalog.slice(0, 2) })).status, 400)

// 4. AI 응답 불량 → 502
geminiText = 'not json'
assert.equal((await run(base)).status, 502)
geminiText = JSON.stringify({ overall: 'x', items: [{ id: 'a', verdict: 'amazing', reason: 'r', alternatives: [] }] })
assert.equal((await run(base)).status, 502)

// 5. 한도 초과(검토는 따로 셈) → 429, Gemini 호출 안 함
usageCount = 20
lastGeminiBody = null
r = await run(base)
assert.equal(r.status, 429)
assert.match(r.json.error, /AI 루틴 검토 한도\(20회\)/)
assert.equal(lastGeminiBody, null)

// 6. 기존 모드는 그대로: 수정 요청 한도 메시지, 처음 만들기
usageCount = 30
const gen = { goal: '근비대', level: '초보', focus: ['코어'], minutes: 45, exercises: catalog, notes: '' }
r = await run({ ...gen, current: [{ id: 'a' }], instruction: '줄여 주세요' })
assert.match(r.json.error, /AI 수정 요청 한도\(30회\)/)
usageCount = 0
geminiText = JSON.stringify({ name: 'n', summary: 's', exercises: [{ id: 'a', sets: 3, reps: 8, restSeconds: 90, linkedToNext: false }, { id: 'b', sets: 3, reps: 12, restSeconds: 60, linkedToNext: false }] })
r = await run(gen)
assert.equal(r.status, 200)
assert.equal(r.json.exercises.length, 2)
assert.equal(recorded.at(-1), 'routine')
console.log('OK: 검토 서버 시나리오 전부 통과')

// 7. 재시도: 첫 응답이 깨져도 두 번째가 정상이면 성공, 사용량은 한 번만 기록, 요청 설정(한도·생각 예산) 확인
usageCount = 0
const goodRoutine = JSON.stringify({ name: 'n', summary: 's', exercises: [{ id: 'a', sets: 3, reps: 8, restSeconds: 90, linkedToNext: false }, { id: 'b', sets: 3, reps: 12, restSeconds: 60, linkedToNext: false }] })
recorded.length = 0; geminiCalls = 0
geminiQueue = ['{"name":"잘린 응답","exercises":[{"id":"a","sets":3', goodRoutine]
r = await run(gen)
assert.equal(r.status, 200)
assert.equal(geminiCalls, 2)
assert.deepEqual(recorded, ['routine'])
assert.equal(lastGeminiBody.generationConfig.maxOutputTokens, 8192)
assert.equal(lastGeminiBody.generationConfig.thinkingConfig.thinkingBudget, 1024)
// 두 번 다 깨지면 502 + 잘림 안내(MAX_TOKENS), 호출은 2번까지만
geminiCalls = 0; finish = 'MAX_TOKENS'; geminiQueue = ['{"name":"잘림', '{"name":"또 잘림']
r = await run(gen)
assert.equal(r.status, 502)
assert.match(r.json.error, /응답이 길어서 잘렸어요/)
assert.equal(geminiCalls, 2)
// 잘림이 아닌 실패는 잘림 문구 없이 한 번 더 시도 안내
geminiCalls = 0; finish = 'STOP'; geminiQueue = ['not json', 'still not json']
r = await run(gen)
assert.equal(r.status, 502)
assert.ok(!/잘렸어요/.test(r.json.error) && /한 번 더 시도/.test(r.json.error))
// 정상 응답은 재시도 없이 1번
geminiCalls = 0; geminiQueue = [goodRoutine]
r = await run(gen)
assert.equal(r.status, 200); assert.equal(geminiCalls, 1)
// 검토 모드도 같은 재시도
geminiCalls = 0; geminiQueue = ['x', JSON.stringify({ overall: 'o', items: [{ id: 'a', verdict: 'good', reason: 'r', alternatives: [] }] })]
r = await run(base)
assert.equal(r.status, 200); assert.equal(geminiCalls, 2)
console.log('OK: 재시도·설정 시나리오 통과')

// 8. 여러 목표: goals 배열(최대 3개·중복·잘못된 값 제거), 예전 goal 문자열 호환, 프롬프트에 섞기 지시
geminiQueue = []; geminiText = goodRoutine; usageCount = 0
const multi = { ...gen, goal: undefined }
r = await run({ ...multi, goals: ['근비대', '체지방 감량'] })
assert.equal(r.status, 200)
let up = lastGeminiBody.contents[0].parts[0].text
assert.match(up, /목표: 근비대 \+ 체지방 감량 \(여러 목표를 섞어서 구성\)/)
assert.match(lastGeminiBody.systemInstruction.parts[0].text, /모든 목표가 루틴에 드러나게 섞는다/)
// 한 개면 섞기 문구 없음, 예전 형식(goal 문자열)도 받는다
r = await run({ ...gen })
assert.equal(r.status, 200)
up = lastGeminiBody.contents[0].parts[0].text
assert.match(up, /목표: 근비대\n/)
// 4개·중복·잘못된 값 → 앞에서 3개까지만
r = await run({ ...multi, goals: ['근비대', '근비대', '해킹', '근력', '체지방 감량', '체력 유지'] })
assert.equal(r.status, 200)
assert.match(lastGeminiBody.contents[0].parts[0].text, /목표: 근비대 \+ 근력 \+ 체지방 감량 \(/)
// 목표가 없거나 전부 잘못되면 400
assert.equal((await run({ ...multi, goals: [] })).status, 400)
assert.equal((await run({ ...multi, goals: ['x'] })).status, 400)
// 꼭 넣을 운동을 AI가 빠뜨렸을 때 채우는 기본 횟수: 근력 포함 5, 근비대 포함 10, 그 외 12 / 휴식 근력 150
const fill = async goals => {
  geminiText = JSON.stringify({ name: 'n', summary: 's', exercises: [{ id: 'a', sets: 3, reps: 8, restSeconds: 90, linkedToNext: false }, { id: 'b', sets: 3, reps: 8, restSeconds: 90, linkedToNext: false }] })
  const out = await run({ ...multi, goals, include: ['c'] })
  return out.json.exercises.find(e => e.id === 'c')
}
assert.deepEqual([(await fill(['체지방 감량', '근력'])).reps, (await fill(['체지방 감량', '근력'])).restSeconds], [5, 150])
assert.equal((await fill(['체지방 감량', '근비대'])).reps, 10)
assert.equal((await fill(['체지방 감량'])).reps, 12)
// 검토 모드: 여러 목표 전달, 없으면 지정 안 함
geminiText = JSON.stringify({ overall: 'o', items: [{ id: 'a', verdict: 'good', reason: 'r', alternatives: [] }] })
r = await run({ ...base, goal: undefined, goals: ['근비대', '체지방 감량'] })
assert.equal(r.status, 200)
assert.match(lastGeminiBody.contents[0].parts[0].text, /목표: 근비대 \+ 체지방 감량\n/)
r = await run({ ...base, goal: undefined })
assert.match(lastGeminiBody.contents[0].parts[0].text, /목표: 지정 안 함/)
console.log('OK: 복수 목표 시나리오 통과')

// 9. 체지방률: 체형 정보에 포함되어 프롬프트에 들어가고, 범위 밖 값은 버리며, 체형을 안 보내면 없다
geminiQueue = []; geminiText = goodRoutine; usageCount = 0
r = await run({ ...multi, goals: ['근비대', '체지방 감량'], body: { gender: '남성', age: 30, heightCm: 175, weightKg: 80, bodyFatPct: 28.46 } })
assert.equal(r.status, 200)
up = lastGeminiBody.contents[0].parts[0].text
assert.match(up, /체형: 남성, 30세, 키 175cm, 몸무게 80kg, BMI 26\.1, 체지방률 28\.5%/)
assert.match(lastGeminiBody.systemInstruction.parts[0].text, /목표가 여러 개\*\*이면, 목표를 섞는 비중/)
r = await run({ ...multi, goals: ['근비대', '체지방 감량'], body: { bodyFatPct: 90, heightCm: 175 } })
assert.ok(!/체지방률/.test(lastGeminiBody.contents[0].parts[0].text.split('[사용 가능한')[0].replace(/목표:.*/, '')), '범위 밖 체지방률이 프롬프트에 들어감')
r = await run({ ...multi, goals: ['근비대', '체지방 감량'], body: { bodyFatPct: 22 } })
assert.match(lastGeminiBody.contents[0].parts[0].text, /체형: 체지방률 22%/)
r = await run({ ...multi, goals: ['근비대', '체지방 감량'] })
assert.ok(!/체형:/.test(lastGeminiBody.contents[0].parts[0].text))
console.log('OK: 체지방률 시나리오 통과')

// 10. 내 목표 힌트: 방향·크기만 받는다(허용 값만), 체형 숫자 없이 힌트만 와도 체형 줄은 없고 목표 줄이 생긴다
geminiQueue = []; geminiText = goodRoutine; usageCount = 0
const two = { ...multi, goals: ['근비대', '체지방 감량'] }
r = await run({ ...two, body: { gender: '남성', age: 30, goalHint: { direction: '감량', level: '큼' } } })
assert.equal(r.status, 200)
up = lastGeminiBody.contents[0].parts[0].text
assert.match(up, /체형: 남성, 30세\n내 목표\(목표 체중·체지방률 대비\): 감량 필요 정도 큼/)
assert.match(lastGeminiBody.systemInstruction.parts[0].text, /"내 목표" 정보가 있고 \*\*목표가 여러 개\*\*이면 그 방향을 가장 우선/)
r = await run({ ...two, body: { goalHint: { direction: '유지', level: '작음' } } })
up = lastGeminiBody.contents[0].parts[0].text
assert.ok(!/체형:/.test(up))
assert.match(up, /내 목표\(목표 체중·체지방률 대비\): 현재 체성분이 목표 근처 — 유지/)
r = await run({ ...two, body: { goalHint: { direction: '증량', level: '보통' }, weightKg: 70 } })
assert.match(lastGeminiBody.contents[0].parts[0].text, /체형: 몸무게 70kg\n내 목표.*증량 필요 정도 보통/)
// 허용 밖 값·형식 오류·숫자(목표 체중 등)는 버린다 — 체형이 하나도 안 남으면 body 없음
for (const bad of [{ direction: '폭증', level: '큼' }, { direction: '감량', level: '엄청' }, '감량', 5, null, { direction: '감량' }]) {
  r = await run({ ...two, body: { goalHint: bad } })
  assert.equal(r.status, 200)
  up = lastGeminiBody.contents[0].parts[0].text
  assert.ok(!/내 목표\(|체형:/.test(up), JSON.stringify(bad))
}
r = await run({ ...two, body: { goalHint: { direction: '감량', level: '큼', targetWeightKg: 60, goalWeightKg: 60 } } })
assert.ok(!/60/.test(lastGeminiBody.contents[0].parts[0].text.split('[사용 가능한')[0].replace(/운동 시간: 45분.*/, '')), '목표 숫자가 프롬프트에 들어감')
console.log('OK: 목표 힌트 시나리오 통과')

// 11. 집중 부위: 새 부위 칩 + 예전 칩 값(옛 화면) 모두 받는다, 모르는 값은 버린다
geminiQueue = []; geminiText = goodRoutine; usageCount = 0
r = await run({ ...multi, goals: ['근비대'], focus: ['등', '어깨'] })
assert.equal(r.status, 200)
assert.match(lastGeminiBody.contents[0].parts[0].text, /집중 부위: 등, 어깨\n/)
assert.match(lastGeminiBody.systemInstruction.parts[0].text, /그 부위가 주된 목표인 운동만/)
r = await run({ ...multi, goals: ['근비대'], focus: ['가슴', '하체', '팔(이두·삼두·전완)'] })
assert.match(lastGeminiBody.contents[0].parts[0].text, /집중 부위: 가슴, 하체, 팔\(이두·삼두·전완\)\n/)
r = await run({ ...multi, goals: ['근비대'], focus: ['밀기(가슴·어깨·삼두)', '팔(이두·삼두)'] }) // 옛 화면
assert.equal(r.status, 200)
r = await run({ ...multi, goals: ['근비대'], focus: ['다리', '엉덩이'] })
assert.equal(r.status, 400)
r = await run({ ...multi, goals: ['근비대'], focus: ['등', '해킹'] })
assert.match(lastGeminiBody.contents[0].parts[0].text, /집중 부위: 등\n/)
console.log('OK: 집중 부위 시나리오 통과')

// 12. 짧은 코드: 프롬프트는 UUID 대신 E1.. 코드, 응답의 코드·소문자 코드·예전 실제 id 모두 실제 id로 되돌린다
const U = ['0b1c2d3e-aaaa-4bbb-8ccc-111111111111', '0b1c2d3e-aaaa-4bbb-8ccc-222222222222', '0b1c2d3e-aaaa-4bbb-8ccc-333333333333', '0b1c2d3e-aaaa-4bbb-8ccc-444444444444', '0b1c2d3e-aaaa-4bbb-8ccc-555555555555']
const ucat = catalog.map((c, i) => ({ ...c, id: U[i] }))
const ugen = { ...gen, exercises: ucat, include: [U[2]] }
geminiQueue = []; usageCount = 0
// (a) 코드로 응답(대소문자·공백 섞임) → 실제 id, 프롬프트에 UUID가 없다
geminiText = JSON.stringify({ name: 'n', summary: 's', exercises: [{ id: 'E1', sets: 3, reps: 8, restSeconds: 90, linkedToNext: false }, { id: ' e2 ', sets: 3, reps: 12, restSeconds: 60, linkedToNext: false }] })
r = await run(ugen)
assert.equal(r.status, 200)
assert.deepEqual(r.json.exercises.map(e => e.id).slice(0, 2), [U[0], U[1]])
assert.ok(r.json.exercises.some(e => e.id === U[2]), '꼭 넣을 운동(실제 id)이 채워져야 함')
up = lastGeminiBody.contents[0].parts[0].text
assert.ok(!up.includes('0b1c2d3e'), 'UUID가 프롬프트에 있음')
assert.match(up, /꼭 넣을 운동: 플랭크\(E3\)/)
assert.match(up, /E1 \| 벤치프레스/)
assert.match(lastGeminiBody.systemInstruction.parts[0].text, /E1·E2처럼 생긴 코드/)
// (b) 예전처럼 실제 id로 응답해도 받는다, 섞여도 OK
geminiText = JSON.stringify({ name: 'n', summary: 's', exercises: [{ id: U[0], sets: 3, reps: 8, restSeconds: 90, linkedToNext: false }, { id: 'E2', sets: 3, reps: 12, restSeconds: 60, linkedToNext: false }] })
r = await run(ugen)
assert.deepEqual(r.json.exercises.map(e => e.id).slice(0, 2), [U[0], U[1]])
// (c) 존재하지 않는 코드·한 글자 틀린 UUID는 버리고 개수를 센다(로그는 개수만)
const warns = []
const origWarn = console.warn; console.warn = (...a) => warns.push(a)
geminiText = JSON.stringify({ name: 'n', summary: 's', exercises: [{ id: 'E1', sets: 3, reps: 8, restSeconds: 90, linkedToNext: false }, { id: 'E99', sets: 3, reps: 8, restSeconds: 90, linkedToNext: false }, { id: '0b1c2d3e-aaaa-4bbb-8ccc-222222222223', sets: 3, reps: 8, restSeconds: 90, linkedToNext: false }, { id: 'E2', sets: 3, reps: 8, restSeconds: 90, linkedToNext: false }] })
r = await run(ugen)
console.warn = origWarn
assert.equal(r.status, 200)
assert.deepEqual(r.json.exercises.map(e => e.id).slice(0, 2), [U[0], U[1]])
assert.equal(warns.length, 1)
assert.deepEqual(warns[0][1], { mode: 'routine', total: 4, dropped: 2 })
assert.ok(!JSON.stringify(warns).includes('E99'), '로그에 응답 내용이 들어감')
// (d) 수정 모드: 현재 루틴도 코드로 보여 준다
geminiText = JSON.stringify({ name: 'n', summary: 's', exercises: [{ id: 'E1', sets: 3, reps: 8, restSeconds: 90, linkedToNext: false }, { id: 'E2', sets: 3, reps: 8, restSeconds: 90, linkedToNext: false }] })
r = await run({ ...ugen, include: [], current: [{ id: U[0], sets: 3, reps: 8, restSeconds: 90 }, { id: U[1], sets: 2, reps: 15, restSeconds: 60 }], instruction: '줄여 주세요' })
assert.equal(r.status, 200)
up = lastGeminiBody.contents[0].parts[0].text
assert.ok(!up.includes('0b1c2d3e'))
assert.match(up, /\[현재 루틴\][^\n]*\nE1 \| 벤치프레스 \| 3×8/)
// (e) 검토 모드: 현재 루틴·대체 후보 모두 코드, 응답 코드 → 실제 id, 현재 루틴에 없는 코드 판정은 버림
const ureview = { review: true, goals: ['근비대'], level: '초보', focus: ['코어'], exercises: ucat, current: [{ id: U[0], sets: 3, reps: 8, restSeconds: 90 }, { id: U[1], sets: 3, reps: 15, restSeconds: 60 }] }
geminiText = JSON.stringify({ overall: 'o', items: [
  { id: 'E2', verdict: 'poor', reason: 'r', alternatives: [{ id: 'e3', reason: 'a' }, { id: 'E1', reason: '현재 루틴' }, { id: 'E77', reason: '없는 코드' }, { id: U[3], reason: '실제 id' }, { id: 'E3', reason: '중복' }] },
  { id: 'E1', verdict: 'good', reason: 'g', alternatives: [] },
  { id: 'E4', verdict: 'good', reason: '현재 루틴에 없음', alternatives: [] },
] })
console.warn = () => {}
r = await run(ureview)
console.warn = origWarn
assert.equal(r.status, 200)
assert.deepEqual(r.json.items.map(i => i.id), [U[0], U[1]])
assert.deepEqual(r.json.items[1].alternatives.map(a => a.id), [U[2], U[3]])
up = lastGeminiBody.contents[0].parts[0].text
assert.ok(!up.includes('0b1c2d3e'))
assert.match(up, /\[현재 루틴\][^\n]*\nE1 \| 벤치프레스[^\n]*3×8\nE2 \| 크런치/)
console.log('OK: 짧은 코드 시나리오 통과')

// 13. 시간 예산: 가짜 시계로 Gemini 응답이 느릴 때 재시도를 건너뛰고, 호출 대기 시간을 남은 시간에 맞춘다
const realNow = Date.now.bind(Date), realSetTimeout = globalThis.setTimeout
let clock = 0
Date.now = () => realNow() + clock
const timers = []
globalThis.setTimeout = (fn, ms, ...rest) => { if (ms >= 1000) timers.push(ms); return realSetTimeout(fn, ms, ...rest) }
const slow = ms => { const origFetch = globalThis.fetch; globalThis.fetch = async (url, opts) => { if (String(url).includes('generativelanguage')) clock += ms; return origFetch(url, opts) } ; return () => { globalThis.fetch = origFetch } }
const errs = []
const origErr = console.error; console.error = (...a) => errs.push(a)
// (a) 첫 응답이 20초 걸리고 못 쓰는 형태 → 남은 시간 7초 < 8초 → 재시도 없음, 502
geminiQueue = ['not json', goodRoutine]; geminiCalls = 0; clock = 0; timers.length = 0
let restore = slow(20000)
r = await run(gen)
restore()
assert.equal(r.status, 502)
assert.equal(geminiCalls, 1, '시간이 모자라는데 재시도함')
assert.ok(errs.some(e => String(e[0]).includes('남은 시간이 부족')), '재시도 생략 로그 없음')
// (b) 첫 응답이 10초 걸리고 못 쓰는 형태 → 남은 17초 → 재시도, 두 번째 호출의 대기 시간은 남은 시간에서 1초를 뺀 값 이하
geminiQueue = ['not json', goodRoutine]; geminiCalls = 0; clock = 0; timers.length = 0
restore = slow(10000)
r = await run(gen)
restore()
assert.equal(r.status, 200)
assert.equal(geminiCalls, 2)
const waits = timers.filter(ms => ms <= 25000 && ms >= 3000)
assert.ok(waits.length >= 2 && waits[0] <= 25000 && waits[1] <= 27000 - 10000 - 1000 + 5, `대기 시간 ${JSON.stringify(waits)}`)
// (c) 평소(빠른 응답): 첫 대기 시간은 25초 그대로
geminiQueue = [goodRoutine]; clock = 0; timers.length = 0
r = await run(gen)
assert.equal(r.status, 200)
assert.ok(timers.includes(25000), `대기 시간 ${JSON.stringify(timers)}`)
// (d) 인증·사용량 확인이 느려서 남은 시간이 적을 때도 호출 대기 시간은 최소 3초
geminiQueue = [goodRoutine]; clock = 0; timers.length = 0
const origFetch2 = globalThis.fetch
globalThis.fetch = async (url, opts) => { if (String(url).includes('/rest/v1/ai_usage') || String(url).includes('/auth/v1/user')) clock += 12000; return origFetch2(url, opts) }
r = await run(gen)
globalThis.fetch = origFetch2
assert.equal(r.status, 200)
assert.ok(timers.some(ms => ms < 25000 && ms >= 3000), `대기 시간 ${JSON.stringify(timers)}`)
Date.now = realNow; globalThis.setTimeout = realSetTimeout; console.error = origErr
console.log('OK: 시간 예산 시나리오 통과')

// 14. 한쪽씩 표시: 목록의 유형 칸에 "·한쪽씩"이 붙고, 표시 없는 운동은 그대로, 시스템 프롬프트에 기준 설명이 있다
geminiQueue = []; geminiText = goodRoutine; usageCount = 0
const ucat2 = catalog.map((c, i) => (i === 1 ? { ...c, unilateral: true } : i === 2 ? { ...c, unilateral: true, type: '' } : i === 3 ? { ...c, unilateral: false } : c))
r = await run({ ...gen, exercises: ucat2 })
assert.equal(r.status, 200)
up = lastGeminiBody.contents[0].parts[0].text
assert.match(up, /E2 \| 크런치 \| 복근 \| 맨몸 \| 코어 \| 단관절·한쪽씩\n/)
assert.match(up, /E3 \| 플랭크 \| 복근 \| 맨몸 \| 코어 \| 한쪽씩\n/)   // 유형이 비어 있어도 "한쪽씩"만
assert.match(up, /E1 \| 벤치프레스 \| 가슴\/삼두 \| 바벨 \| 밀기 \| 복합관절\n/) // 표시 없는 운동은 그대로
assert.match(up, /E4 \| 케이블 크런치 \| 복근 \| 케이블 \| 코어 \| 단관절\n/)
assert.match(lastGeminiBody.systemInstruction.parts[0].text, /"한쪽씩"이 붙은 운동.*반복수가 \*\*한쪽 기준\*\*/)
// unilateral 값이 true가 아니면(문자열 "true", 1 등) 표시하지 않는다
r = await run({ ...gen, exercises: catalog.map((c, i) => (i === 1 ? { ...c, unilateral: 'true' } : i === 2 ? { ...c, unilateral: 1 } : c)) })
assert.ok(!/한쪽씩\n/.test(lastGeminiBody.contents[0].parts[0].text.split('[사용 가능한')[1]), '잘못된 값이 표시로 인정됨')
// 검토 모드: 현재 루틴·대체 후보 모두 표시가 붙는다
geminiText = JSON.stringify({ overall: 'o', items: [{ id: 'E1', verdict: 'good', reason: 'g', alternatives: [] }] })
r = await run({ ...base, exercises: ucat2 })
up = lastGeminiBody.contents[0].parts[0].text
assert.match(up, /E2 \| 크런치[^\n]*단관절·한쪽씩 \| 3×15/)
assert.match(up, /E3 \| 플랭크[^\n]*\| 한쪽씩\n/)
console.log('OK: 한쪽씩 AI 시나리오 통과')

// 15. 한도 원자화: DB 함수(consume_ai_usage)로 한 번에 확인+기록, 함수가 없으면 예전 방식으로 대체, 동시 요청 비교
rpcMode = 'ok'; liveUsage = false; usageCount = 0; geminiQueue = []; geminiText = goodRoutine
recorded.length = 0; rpcCalls.length = 0
r = await run(gen)
assert.equal(r.status, 200)
assert.deepEqual(rpcCalls, [{ p_kind: 'routine', p_limit: 10 }])      // 종류·한도를 DB 함수로 넘긴다
assert.deepEqual(recorded, ['routine']); assert.equal(r.json.remaining, 9)
// 수정 요청·검토는 각자 종류와 한도
rpcCalls.length = 0
await run({ ...gen, current: [{ id: 'a' }], instruction: '줄여 주세요' })
await run(base)
assert.deepEqual(rpcCalls.map(c => [c.p_kind, c.p_limit]), [['refine', 30], ['review', 20]])
// 한도 초과(-1) → 429, Gemini 호출 없음
usageCount = 10; lastGeminiBody = null
r = await run(gen)
assert.equal(r.status, 429); assert.match(r.json.error, /AI 사용 한도\(10회\)/); assert.equal(lastGeminiBody, null)
// 함수가 없을 때(SQL 미실행): 404 + PGRST202 → 예전 방식(조회→기록)으로 처리하고 경고를 남긴다. 사용량 오류 안내는 아니다.
usageCount = 3; rpcMode = 'missing'; recorded.length = 0
const warns15 = []; const ow = console.warn; console.warn = (...a) => warns15.push(a)
r = await run(gen)
console.warn = ow
assert.equal(r.status, 200); assert.equal(r.json.remaining, 6); assert.deepEqual(recorded, ['routine'])
assert.ok(warns15.some(w => String(w[0]).includes('consume_ai_usage 함수가 없어')))
// 예전 방식에서도 한도는 지킨다
usageCount = 10; r = await run(gen); assert.equal(r.status, 429)
// 권한 오류(42501)·이상한 응답은 500 + 원인 안내, Gemini 호출 없음
usageCount = 0; rpcMode = 'denied'; lastGeminiBody = null
const oe = console.error; console.error = () => {}
r = await run(gen)
assert.equal(r.status, 500); assert.match(r.json.error, /권한이 없어요[\s\S]*42501/); assert.equal(lastGeminiBody, null)
rpcMode = 'garbage'
r = await run(gen)
console.error = oe
assert.equal(r.status, 500); assert.match(r.json.error, /BAD_RPC/); assert.equal(lastGeminiBody, null)

// 동시에 15개 요청(한도 10): DB 함수 방식은 정확히 10개만 통과
rpcMode = 'ok'; liveUsage = true; usageCount = 0; recorded.length = 0; geminiCalls = 0
let results = await Promise.all(Array.from({ length: 15 }, () => run(gen)))
assert.equal(results.filter(x => x.status === 200).length, 10)
assert.equal(results.filter(x => x.status === 429).length, 5)
assert.equal(geminiCalls, 10, `Gemini 호출 ${geminiCalls}`)
// 같은 상황을 예전 방식(함수 없음)으로 흉내 내면 한도를 넘겨 전부 통과한다(이번에 막은 취약점)
rpcMode = 'missing'; usageCount = 0; recorded.length = 0; geminiCalls = 0
const ow2 = console.warn; console.warn = () => {}
results = await Promise.all(Array.from({ length: 15 }, () => run(gen)))
console.warn = ow2
const passedLegacy = results.filter(x => x.status === 200).length
assert.ok(passedLegacy > 10, `예전 방식 통과 ${passedLegacy}개`)
liveUsage = false; rpcMode = 'ok'

// 16. 맨몸 운동 반복수: 프롬프트 규칙, 내 최고 기록 전달(검증·중복·범위), 최고 기록보다 많은 횟수는 서버가 줄인다
usageCount = 0; geminiQueue = []; geminiText = goodRoutine
r = await run({ ...gen, history: { bodyweightBest: [{ id: 'b', reps: 6 }, { id: 'zzz', reps: 5 }, { id: 'b', reps: 9 }, { id: 'e', reps: 0 }, { id: 'c', reps: 500 }, { id: 'd', reps: 'x' }] } })
assert.equal(r.status, 200)
up = lastGeminiBody.contents[0].parts[0].text
assert.match(lastGeminiBody.systemInstruction.parts[0].text, /맨몸 운동.*반복수는 위의 목표별 반복수를 그대로 쓰지 않는다/)
assert.match(up, /내 맨몸 운동 최고 기록\(한 세트 최대 횟수\): 크런치\(E2\) 6회, 플랭크\(E3\) 100회\n/) // 목록에 없는 id·0회·숫자 아님은 버리고, 중복은 먼저 온 값, 횟수는 100까지
assert.ok(!up.includes('zzz'))
// 최고 기록보다 많게 정한 횟수(크런치 12회)는 최고 기록(6회)으로 줄고, 기록이 없는 운동(벤치프레스 8회)은 그대로
assert.deepEqual(r.json.exercises.map(e => [e.id, e.reps]), [['a', 8], ['b', 6]])
// 기록이 목표보다 크면(이미 최고 기록 이하) 줄이지 않는다
geminiText = JSON.stringify({ name: 'n', summary: 's', exercises: [{ id: 'E2', sets: 3, reps: 5, restSeconds: 60, linkedToNext: false }, { id: 'E1', sets: 3, reps: 8, restSeconds: 90, linkedToNext: false }] })
r = await run({ ...gen, history: { bodyweightBest: [{ id: 'b', reps: 6 }] } })
assert.deepEqual(r.json.exercises.map(e => [e.id, e.reps]), [['b', 5], ['a', 8]])
// 최고 기록만 있어도(자주 한 운동·안 쓴 부위 없이) history로 인정된다 / 없으면 줄이 없고 횟수도 그대로
r = await run({ ...gen, history: { frequent: [], neglected: [], bodyweightBest: [{ id: 'b', reps: 6 }] } })
assert.match(lastGeminiBody.contents[0].parts[0].text, /내 맨몸 운동 최고 기록/)
geminiText = goodRoutine
r = await run({ ...gen, history: { frequent: ['a'] } })
assert.ok(!lastGeminiBody.contents[0].parts[0].text.includes('내 맨몸 운동 최고 기록'))
assert.deepEqual(r.json.exercises.map(e => [e.id, e.reps]), [['a', 8], ['b', 12]])
r = await run({ ...gen, history: { bodyweightBest: 'x' } })
assert.ok(!lastGeminiBody.contents[0].parts[0].text.includes('내 맨몸 운동 최고 기록'))
// 20개까지만 받는다
const many = Array.from({ length: 30 }, (_, i) => ({ id: 'a', reps: i + 1 }))
r = await run({ ...gen, history: { bodyweightBest: many } })
assert.match(lastGeminiBody.contents[0].parts[0].text, /벤치프레스\(E1\) 1회\n/) // 같은 id는 한 번만
console.log('OK: 맨몸 운동 반복수 시나리오 통과')
console.log(`OK: 한도 원자화 시나리오 통과 (동시 15요청: DB 함수 10개 통과 / 예전 방식 ${passedLegacy}개 통과)`)
