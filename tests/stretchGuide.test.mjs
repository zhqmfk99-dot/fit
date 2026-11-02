import assert from 'node:assert/strict'
import { stretchPlan, planMinutes, itemSeconds } from '../src/lib/stretchGuide.js'
import { youtubeHowToUrl } from '../src/lib/exerciseGuide.js'
import { TRAINABLE_MUSCLES } from '../src/lib/muscleMap.js'

const ids = (k, m) => stretchPlan(k, m).map(i => i.id)

// 워밍업: 가벼운 유산소가 항상 맨 앞, 부위는 처음 나온 순서
assert.deepEqual(ids('warmup', ['chest', 'triceps', 'chest', 'front-deltoids']), ['w-cardio', 'w-chest', 'w-arm', 'w-shoulder'])
// 같은 동작(고양이-낙타)은 등·허리·... 여러 부위에서도 한 번만
assert.deepEqual(ids('warmup', ['upper-back', 'lower-back', 'trapezius']), ['w-cardio', 'w-catcamel'])
// 어깨 앞·뒤, 내전·외전 등 같은 부위 묶음은 한 번만
assert.deepEqual(ids('warmup', ['front-deltoids', 'back-deltoids']), ['w-cardio', 'w-shoulder'])
assert.deepEqual(ids('warmup', ['adductor', 'abductors']), ['w-cardio', 'w-hip'])
// 부위 정보가 없거나 모르는 슬러그 → 기본 동작만
assert.deepEqual(ids('warmup', []), ['w-cardio'])
assert.deepEqual(ids('warmup', ['head', 'knees', 'neck']), ['w-cardio'])
assert.deepEqual(ids('cooldown', []), ['c-breath'])
// 스트레칭: 마지막은 항상 심호흡, only 조건: 삼두만 있으면 삼두 동작만, 이두·전완이면 손목 동작
assert.deepEqual(ids('cooldown', ['triceps']), ['c-triceps', 'c-breath'])
assert.deepEqual(ids('cooldown', ['biceps']), ['c-wrist', 'c-breath'])
assert.deepEqual(ids('cooldown', ['biceps', 'triceps']), ['c-triceps', 'c-wrist', 'c-breath'])
assert.deepEqual(ids('cooldown', ['abs']), ['c-cobra', 'c-breath'])
assert.deepEqual(ids('cooldown', ['obliques']), ['c-sidebend', 'c-breath'])
// 모든 근육을 넣어도 상한(워밍업 7, 스트레칭 8+심호흡) 이내, id 중복 없음
const all = stretchPlan('warmup', TRAINABLE_MUSCLES)
assert.ok(all.length <= 7 && new Set(all.map(i => i.id)).size === all.length, `워밍업 ${all.length}`)
const allC = stretchPlan('cooldown', TRAINABLE_MUSCLES)
assert.ok(allC.length <= 9 && allC.at(-1).id === 'c-breath' && new Set(allC.map(i => i.id)).size === allC.length, `스트레칭 ${allC.length}`)
// 모든 동작에 이름·방법·시간이 있다(부위 하나씩 돌려 전수 확인)
for (const m of TRAINABLE_MUSCLES) for (const k of ['warmup', 'cooldown']) {
  const items = stretchPlan(k, [m])
  assert.ok(items.length >= 1)
  for (const it of items) assert.ok(it.name && it.how && it.seconds > 0, `${k}/${m}/${it.id}`)
}
// 시간: 좌우 동작은 두 배, 분은 반올림(최소 1분)
assert.equal(itemSeconds({ seconds: 30, perSide: true }), 60)
assert.equal(itemSeconds({ seconds: 30 }), 30)
assert.equal(planMinutes([{ seconds: 20 }]), 1)
assert.equal(planMinutes(stretchPlan('warmup', ['quadriceps'])), 4) // 180 + 20×2 = 220초 ≈ 4분
// 같은 입력은 같은 결과
assert.deepEqual(ids('cooldown', ['chest', 'quadriceps']), ids('cooldown', ['chest', 'quadriceps']))
// 유튜브 링크
assert.equal(youtubeHowToUrl('아기 자세'), 'https://www.youtube.com/results?search_query=' + encodeURIComponent('아기 자세 방법'))
console.log('OK: 스트레칭 계획 전부 통과')
