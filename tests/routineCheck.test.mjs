import assert from 'node:assert/strict'
import { checkRoutineBalance } from '../src/lib/routineCheck.js'

const cat = [
  { name: '벤치프레스', movementPattern: '밀기', exerciseType: '복합관절' },
  { name: '숄더프레스', movementPattern: '밀기', exerciseType: '복합관절' },
  { name: '푸시다운', movementPattern: '밀기', exerciseType: '단관절' },
  { name: '랫풀다운', movementPattern: '당기기', exerciseType: '복합관절' },
  { name: '바벨컬', movementPattern: '당기기', exerciseType: '단관절' },
  { name: '스쿼트', movementPattern: '스쿼트', exerciseType: '복합관절' },
  { name: '크런치', movementPattern: '코어', exerciseType: '단관절' },
]
const row = (exercise, sets = 3) => ({ exercise, sets })
const texts = (rows, o) => checkRoutineBalance(rows, cat, o).map(c => `${c.level}:${c.text}`)

// 밀기만 있는 날은 의도된 구성 → 경고 없음(집중 부위를 모를 때)
assert.deepEqual(texts([row('벤치프레스'), row('숄더프레스'), row('푸시다운')]), [])
// 밀기 9 : 당기기 3 → 경고
let t = texts([row('벤치프레스'), row('숄더프레스'), row('푸시다운'), row('랫풀다운')])
assert.ok(t.some(x => x.startsWith('warn:밀기 9세트 · 당기기 3세트')), t.join('|'))
// 균형 잡힌 구성 → 없음
assert.deepEqual(texts([row('벤치프레스'), row('랫풀다운'), row('숄더프레스'), row('바벨컬')]), [])
// 당기기 쏠림은 안내(info)
t = texts([row('벤치프레스'), row('랫풀다운'), row('바벨컬'), row('랫풀다운')])
assert.ok(t.some(x => x.startsWith('info:당기기')), t.join('|'))
// 전신인데 하체 없음 + 당기기 없음
t = texts([row('벤치프레스'), row('숄더프레스')], { focus: ['전신'] })
assert.ok(t.some(x => x.includes('당기기(등·이두) 운동이 없어요')))
assert.ok(t.some(x => x.includes('하체')))
// 전신인데 모두 있으면 없음
assert.deepEqual(texts([row('스쿼트'), row('벤치프레스'), row('랫풀다운')], { focus: ['전신'] }), [])
// 하체 날: 하체만 있어도 경고 없음(집중 부위가 하체)
assert.deepEqual(texts([row('스쿼트')], { focus: ['하체'] }), [])
// 순서: 고립이 복합보다 앞 → info / 코어 고립은 예외
t = texts([row('바벨컬'), row('랫풀다운')])
assert.ok(t.some(x => x.startsWith('info:단관절')))
assert.deepEqual(texts([row('크런치'), row('스쿼트')]), [])
// 중복·총 세트
t = texts([row('벤치프레스', 5), row('벤치프레스', 5), row('랫풀다운', 5), row('스쿼트', 5), row('바벨컬', 5)])
assert.ok(t.some(x => x.includes('두 번')) && t.some(x => x.includes('총 25세트')), t.join('|'))
// 카탈로그에 없는 운동·빈 행은 무시, 빈 루틴은 []
assert.deepEqual(texts([row('내가 만든 운동'), row('')]), [])
assert.deepEqual(texts([]), [])
console.log('OK: 규칙 점검 전부 통과')
