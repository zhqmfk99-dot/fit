import assert from 'node:assert/strict'
import { platesPerSide, platesText, BAR_KG, PLATES_KG } from '../src/lib/plateMath.js'

const txt = total => platesText(platesPerSide(total).perSide)

// 기본 구성
assert.equal(txt(60), '20')                // (60-20)/2 = 20
assert.equal(txt(100), '25 + 15')          // 40
assert.equal(txt(140), '25×2 + 10')        // 60
assert.equal(txt(62.5), '20 + 1.25')       // 21.25
assert.equal(txt(45), '10 + 2.5')          // 12.5
assert.equal(txt(22.5), '1.25')            // 1.25
assert.equal(txt(180), '25×3 + 5')         // 80 (큰 원판부터)

// 빈 봉 / 봉보다 가벼움 / 잘못된 값
assert.equal(platesPerSide(20).kind, 'bar')
assert.deepEqual(platesPerSide(20).perSide, [])
assert.equal(platesPerSide(15).kind, 'light')
assert.equal(platesPerSide(0).kind, 'invalid')
assert.equal(platesPerSide(null).kind, 'invalid')
assert.equal(platesPerSide('abc').kind, 'invalid')
assert.equal(platesPerSide(-5).kind, 'invalid')

// 정확히 맞는 무게는 exact, 1.25kg 단위가 아니면 아래로 맞추고 모자란 만큼을 알려 준다
assert.equal(platesPerSide(60).exact, true)
{
  const r = platesPerSide(61) // 한쪽 20.5 → 20, 0.5 모자람 → 총 1kg
  assert.equal(r.exact, false)
  assert.equal(r.shortKg, 1)
  assert.equal(platesText(r.perSide), '20')
}
{
  const r = platesPerSide(61.25) // 한쪽 20.625 → 20 + 0.625 모자람 → 총 1.25
  assert.equal(r.shortKg, 1.25)
}

// 모든 결과는 합계가 한쪽 무게 이하이고 정확하면 정확히 같다 — 0.25kg 간격 전수 검사
for (let t = 20; t <= 300; t += 0.25) {
  const r = platesPerSide(t)
  const sum = r.perSide.reduce((a, p) => a + p.plate * p.count, 0)
  const want = (t - BAR_KG) / 2
  assert.ok(sum <= want + 1e-9, `${t}: ${sum} > ${want}`)
  assert.equal(r.exact, Math.abs(sum - want) < 1e-9, `${t} exact`)
  assert.ok(Math.abs((want - sum) * 2 - r.shortKg) < 1e-6, `${t} shortKg`)
  assert.ok(r.perSide.every(p => PLATES_KG.includes(p.plate) && p.count >= 1))
}

// 다른 봉(15kg 여성용)·다른 원판 구성도 받는다
assert.equal(platesText(platesPerSide(50, { bar: 15 }).perSide), '15 + 2.5') // (50-15)/2=17.5
assert.equal(platesText(platesPerSide(60, { plates: [10, 5] }).perSide), '10×2') // 20 → 10 + 10

console.log('OK: 원판 계산 전부 통과')
