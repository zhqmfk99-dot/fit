import assert from 'node:assert/strict'
import { warmupSets, warmupTargetId, warmupText, BAR_KG } from '../src/lib/warmupSets.js'

// 바벨 100kg → 50 / 70 / 85 (2.5kg 단위)
assert.deepEqual(warmupSets(100, { equipment: '바벨' }), [{ weight: 50, reps: 8 }, { weight: 70, reps: 5 }, { weight: 85, reps: 3 }])
// 반올림: 62.5kg → 31.25→32.5, 43.75→42.5(Math.round(17.5)=18→45), 53.1875→52.5
{
  const r = warmupSets(62.5, { equipment: '머신' })
  assert.deepEqual(r.map(s => s.reps), [8, 5, 3])
  assert.ok(r.every(s => s.weight % 2.5 === 0 && s.weight < 62.5))
  assert.ok(r.every((s, i) => i === 0 || s.weight > r[i - 1].weight))
}
// 바벨은 빈 봉(20kg)보다 가볍게 제안하지 않고, 같은 무게 중복은 뺀다
assert.deepEqual(warmupSets(25, { equipment: '바벨' }), [{ weight: BAR_KG, reps: 8 }])
assert.deepEqual(warmupSets(40, { equipment: '바벨' }), [{ weight: 20, reps: 8 }, { weight: 27.5, reps: 5 }, { weight: 35, reps: 3 }]) // 50%=20, 70%=28→27.5, 85%=34→35
// 빈 봉 무게 이하면 제안 없음, 맨몸·0·잘못된 값도 없음
assert.deepEqual(warmupSets(20, { equipment: '바벨' }), [])
assert.deepEqual(warmupSets(0), [])
assert.deepEqual(warmupSets(null), [])
assert.deepEqual(warmupSets('abc'), [])
// 바벨이 아니면 하한 없음(덤벨 10kg → 5, 7.5)
assert.deepEqual(warmupSets(10, { equipment: '덤벨' }).map(s => s.weight), [5]) // 7.5는 앞 단계와 2.5kg 차이라 뺀다
// 모든 제안은 본 무게보다 가볍고 오름차순
for (const w of [12.5, 22.5, 30, 47.5, 60, 82.5, 120, 200]) {
  for (const equipment of ['바벨', '덤벨', '머신']) {
    const r = warmupSets(w, { equipment })
    assert.ok(r.every(s => s.weight < w), `${w}/${equipment}`)
    assert.ok(r.every((s, i) => i === 0 || s.weight > r[i - 1].weight), `${w}/${equipment} 오름차순`)
  }
}
assert.equal(warmupText([{ weight: 20, reps: 8 }, { weight: 35, reps: 5 }]), '20kg × 8 → 35kg × 5')

// 대상 운동: 첫 복합관절·무게 있는 운동. 끝났으면 null, 건너뛴 운동은 제외, 단관절·맨몸은 제외
{
  const meta = { 벤치: { exerciseType: '복합관절' }, 컬: { exerciseType: '단관절' }, 푸쉬업: { exerciseType: '복합관절' }, 로우: { exerciseType: '복합관절' } }
  const metaOf = l => meta[l.exercise]
  const L = (id, exercise, extra = {}) => ({ id, exercise, targetWeight: 40, isCompleted: false, skipped: false, ...extra })
  assert.equal(warmupTargetId([L('a', '컬'), L('b', '벤치'), L('c', '로우')], metaOf), 'b')
  assert.equal(warmupTargetId([L('a', '푸쉬업', { targetWeight: 0 }), L('b', '벤치')], metaOf), 'b') // 맨몸은 건너뜀
  assert.equal(warmupTargetId([L('a', '벤치', { isCompleted: true }), L('c', '로우')], metaOf), null) // 첫 복합을 끝냈으면 이후는 없음
  assert.equal(warmupTargetId([L('a', '벤치', { skipped: true }), L('c', '로우')], metaOf), 'c')
  assert.equal(warmupTargetId([L('a', '컬')], metaOf), null)
  assert.equal(warmupTargetId([], metaOf), null)
  assert.equal(warmupTargetId([L('a', '모름')], metaOf), null)
}

console.log('OK: 웜업 세트 제안 전부 통과')
