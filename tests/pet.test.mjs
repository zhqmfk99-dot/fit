import test from 'node:test'
import assert from 'node:assert/strict'
import { HATCH_XP, TEEN_XP, MAX_XP, EGG_COST, SPECIES, stageOf, petView, feedOptions, petErrorMessage, collectionEmoji } from '../src/lib/pet.js'

test('규칙 상수는 서버(points.sql)와 같다', () => {
  assert.deepEqual([HATCH_XP, TEEN_XP, MAX_XP, EGG_COST], [20, 80, 200, 50])
  assert.deepEqual(Object.keys(SPECIES).sort(), ['cat', 'chick', 'dragon', 'fish'])
  for (const s of Object.values(SPECIES)) assert.equal(s.stages.length, 3)
})

test('경험치 → 단계 경계', () => {
  assert.deepEqual([0, 19, 20, 79, 80, 199, 200].map(stageOf), [0, 0, 1, 1, 2, 2, 3])
})

test('표시: 알은 종류 없이 🥚, 부화하면 종류별 이모지', () => {
  assert.equal(petView({ species: null, xp: 10 }).emoji, '🥚')
  assert.equal(petView({ species: null, xp: 10 }).speciesName, '알')
  assert.equal(petView({ species: 'chick', xp: 20 }).emoji, '🐣')
  assert.equal(petView({ species: 'dragon', xp: 100 }).emoji, '🐊')
  assert.equal(petView({ species: 'cat', xp: 200 }).emoji, '🦁')
  assert.equal(petView({ species: 'fish', xp: 200 }).complete, true)
  assert.equal(petView({ species: 'unknown', xp: 50 }).emoji, '❓') // 모르는 종류도 깨지지 않는다
})

test('표시: 다음 단계까지와 진행률', () => {
  const a = petView({ species: null, xp: 10 })
  assert.deepEqual([a.nextAt, a.toNext, a.progress], [20, 10, 0.5])
  const b = petView({ species: 'cat', xp: 50 }) // 아기: 20~80
  assert.deepEqual([b.nextAt, b.toNext, b.progress], [80, 30, 0.5])
  const c = petView({ species: 'cat', xp: 200 })
  assert.deepEqual([c.nextAt, c.toNext, c.progress, c.stageName], [null, 0, 1, '다 자란'])
  assert.equal(petView({ species: 'cat', xp: 999 }).xp, 200) // 범위 밖은 자른다
  assert.equal(petView(null).emoji, '🥚')
})

test('먹이 버튼: 남은 양으로 줄이고 가진 포인트로 못 사면 disabled', () => {
  assert.deepEqual(feedOptions(100, 0), [{ amount: 5, disabled: false }, { amount: 10, disabled: false }, { amount: 20, disabled: false }])
  assert.deepEqual(feedOptions(7, 0).map(o => o.disabled), [false, true, true])
  assert.deepEqual(feedOptions(100, 192), [{ amount: 5, disabled: false }, { amount: 8, disabled: false }]) // 남은 8 → 10·20은 8로 합쳐진다
  assert.deepEqual(feedOptions(100, 200), [])
})

test('오류 문구와 도감 이모지', () => {
  assert.equal(petErrorMessage({ message: 'not_enough_points' }), '포인트가 부족해요.')
  assert.equal(petErrorMessage(new Error('already_has_pet')), '이미 키우는 펫이 있어요.')
  assert.equal(petErrorMessage('이상한 오류'), '잠시 후 다시 시도해 주세요.')
  assert.equal(collectionEmoji({ species: 'dragon' }), '🐉')
  assert.equal(collectionEmoji(null), '❓')
})