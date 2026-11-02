import assert from 'node:assert/strict'
import { pickDay, planSplit, buildRoutines, sanitizePresets, defaultsFor, defaultWeekdays, dayLabel, BUILTIN_PRESETS, SPLIT_GROUPS, GROUP_MUSCLES, MAX_CUSTOM_PRESETS } from '../src/lib/splitPlan.js'

const NOW = new Date(2026, 5, 30)
const E = (name, muscles, equipment, exerciseType, extra = {}) => ({ id: name, name, muscles, equipment, exerciseType, movementPattern: '기타', tags: [], ...extra })
const catalog = [
  E('벤치프레스', ['chest', 'triceps'], '바벨', '복합관절'),
  E('인클라인 덤벨프레스', ['chest', 'front-deltoids'], '덤벨', '복합관절'),
  E('푸쉬업', ['chest', 'triceps'], '맨몸', '복합관절'),
  E('케이블 플라이', ['chest'], '케이블', '단관절'),
  E('랫풀다운', ['upper-back', 'biceps'], '머신', '복합관절'),
  E('바벨 로우', ['upper-back', 'biceps'], '바벨', '복합관절'),
  E('시티드 로우', ['upper-back', 'biceps'], '머신', '복합관절'),
  E('페이스 풀', ['back-deltoids', 'upper-back'], '케이블', '단관절'),
  E('오버헤드 프레스', ['front-deltoids', 'triceps'], '바벨', '복합관절'),
  E('사이드 레이즈', ['front-deltoids'], '덤벨', '단관절'),
  E('바벨 컬', ['biceps'], '바벨', '단관절'),
  E('해머 컬', ['biceps'], '덤벨', '단관절'),
  E('트라이셉스 푸시다운', ['triceps'], '케이블', '단관절'),
  E('스쿼트', ['quadriceps', 'gluteal'], '바벨', '복합관절'),
  E('루마니안 데드리프트', ['hamstring', 'gluteal'], '바벨', '복합관절'),
  E('레그 익스텐션', ['quadriceps'], '머신', '단관절'),
  E('카프 레이즈', ['calves'], '머신', '단관절'),
  E('플랭크', ['abs'], '맨몸', '단관절'),
  E('크런치', ['abs'], '맨몸', '단관절'),
  E('이름 없는 근육 운동', [], '기타', '단관절'),
]
const done = (date, exercise, weight = 40) => ({ id: `${date}-${exercise}`, date, exercise, isCompleted: true, targetWeight: weight, performedSets: [{ reps: 8, weight }] })

// 같은 입력이면 항상 같은 결과
{
  const a = pickDay(['가슴'], catalog, [], { now: NOW }).map(p => p.exercise.name)
  const b = pickDay(['가슴'], catalog, [], { now: NOW }).map(p => p.exercise.name)
  assert.deepEqual(a, b)
}

// 부위 하나(가슴): 5개를 채우려 해도 후보가 4개(푸쉬업 포함)라 후보만큼만, 복합관절이 단관절보다 앞
{
  const r = pickDay(['가슴'], catalog, [], { now: NOW })
  assert.equal(r.length, 4)
  assert.deepEqual(r.map(p => p.exercise.name), ['벤치프레스', '인클라인 덤벨프레스', '푸쉬업', '케이블 플라이']) // 복합 3(이름순) → 단관절
}

// 최근 기록이 많은 운동이 앞선다(복합 보너스보다 사용 횟수 가중이 큼), 90일이 지난 기록은 안 센다
{
  const logs = [done('2026-06-20', '케이블 플라이'), done('2026-06-10', '케이블 플라이'), done('2026-05-30', '케이블 플라이'), done('2025-01-01', '푸쉬업'), done('2025-01-02', '푸쉬업'), done('2025-01-03', '푸쉬업')]
  const names = pickDay(['가슴'], catalog, logs, { now: NOW, perDay: 4 }).map(p => p.exercise.name)
  assert.equal(names.length, 4)
  // 케이블 플라이(3일×3=9)가 점수 1위로 뽑히지만, 복합관절이 먼저 오도록 최종 정렬
  assert.ok(names.includes('케이블 플라이'))
  assert.equal(names[names.length - 1], '케이블 플라이')
  // 오래된 푸쉬업 기록은 가산점이 없다 → 푸쉬업이 이름순대로 밀린 위치(복합 중 마지막)
  assert.equal(names.indexOf('푸쉬업'), 2)
}

// 여러 부위: 고르게 나눈다(등+어깨, 5개 → 등 3 + 어깨 2), 부위에 안 맞는 운동은 안 뽑는다
{
  const r = pickDay(['등', '어깨'], catalog, [], { now: NOW, perDay: 5 })
  assert.equal(r.length, 5)
  assert.equal(r.filter(p => p.group === '등').length, 3)
  assert.equal(r.filter(p => p.group === '어깨').length, 2)
  assert.ok(r.every(p => GROUP_MUSCLES[p.group].includes(p.exercise.muscles[0])))
  // 복합 → 단관절
  const types = r.map(p => p.exercise.exerciseType)
  assert.equal(types.indexOf('단관절') >= types.lastIndexOf('복합관절'), true)
}

// 부위가 운동 수보다 많으면 부위마다 1개 이상
{
  const r = pickDay(['가슴', '등', '어깨', '팔', '하체', '코어'], catalog, [], { now: NOW, perDay: 4 })
  assert.equal(r.length, 6)
  assert.deepEqual([...new Set(r.map(p => p.group))].sort(), [...SPLIT_GROUPS].sort())
}

// 같은 주 근육은 처음 2개까지만, 자리가 남으면 채움(등 3개 중 상위 2개가 같은 주 근육이어도 3개째를 채운다)
{
  const r = pickDay(['등'], catalog, [], { now: NOW, perDay: 3 }).map(p => p.exercise.name)
  assert.equal(r.length, 3)
  assert.equal(new Set(r).size, 3)
}

// 내 운동기구: 바벨·덤벨이 없으면 거기서 제외(맨몸은 항상), 장비 정보 없는 운동은 포함
{
  const r = pickDay(['가슴'], catalog, [], { now: NOW, myEquipment: ['케이블'] }).map(p => p.exercise.name).sort()
  assert.deepEqual(r, ['케이블 플라이', '푸쉬업'])
}
{
  const noEq = [...catalog, E('장비 모름 푸시', ['chest'], '', '복합관절', { equipment: null })]
  assert.ok(pickDay(['가슴'], noEq, [], { now: NOW, myEquipment: ['케이블'] }).some(p => p.exercise.name === '장비 모름 푸시'))
}

// 후보가 모자란 부위의 몫은 다른 부위가 채운다(코어 후보 2개뿐: 코어+하체 6개 → 하체 4 + 코어 2)
{
  const r = pickDay(['코어', '하체'], catalog, [], { now: NOW, perDay: 6 })
  assert.equal(r.length, 6)
  assert.equal(r.filter(p => p.group === '코어').length, 2)
}

// 기본 세트·횟수·휴식
assert.deepEqual(defaultsFor(catalog[0], '가슴'), { sets: 3, reps: 8, restSeconds: 120 })
assert.deepEqual(defaultsFor(catalog[2], '가슴'), { sets: 3, reps: 10, restSeconds: 90 })
assert.deepEqual(defaultsFor(catalog[3], '가슴'), { sets: 3, reps: 12, restSeconds: 60 })
assert.deepEqual(defaultsFor(catalog[17], '코어'), { sets: 3, reps: 15, restSeconds: 45 })

// 분할 전체: 날마다 루틴 이름·부위, 무게는 마지막 기록, 기록 없는 장비 운동은 needsWeight
{
  const preset = BUILTIN_PRESETS.find(p => p.id === 'back-shoulder-arm-chestleg')
  const plan = planSplit(preset, catalog, [done('2026-06-20', '바벨 로우', 55)], { now: NOW })
  assert.equal(plan.length, 3)
  assert.deepEqual(plan.map(d => d.label), ['등+어깨', '팔', '가슴+하체'])
  const row = plan[0].items.find(i => i.exercise === '바벨 로우')
  assert.equal(row.weight, 55)
  assert.equal(row.needsWeight, false)
  const lat = plan[0].items.find(i => i.exercise === '랫풀다운')
  assert.equal(lat.weight, null)
  assert.equal(lat.needsWeight, true)
  const pu = plan[2].items.find(i => i.exercise === '푸쉬업')
  if (pu) assert.equal(pu.needsWeight, false) // 맨몸은 무게 불필요
  assert.equal(dayLabel({ label: '푸시', groups: ['가슴'] }), '푸시')
}

// 루틴 만들기: 요일 배정·이름 중복 번호·입력한 무게·기본 휴식·빈 날 제외
{
  const plan = [
    { label: '등+어깨', groups: ['등', '어깨'], items: [{ exercise: '랫풀다운', sets: 3, reps: 8, restSeconds: 120, weight: null }, { exercise: '바벨 로우', sets: 3, reps: 8, restSeconds: 0, weight: 55 }] },
    { label: '팔', groups: ['팔'], items: [] },
    { label: '가슴', groups: ['가슴'], items: [{ exercise: '푸쉬업', sets: 3, reps: 10, restSeconds: 90, weight: null }] },
  ]
  let n = 0
  const rs = buildRoutines(plan, { weekdays: [['금', '월'], ['화'], ['수']], weights: { 랫풀다운: '45' }, existingNames: ['등+어깨', '등+어깨 (2)'], defaultRest: 75, newId: () => `r${n++}` })
  assert.equal(rs.length, 2) // 빈 날 제외
  assert.equal(rs[0].name, '등+어깨 (3)')
  assert.deepEqual(rs[0].repeatDays, ['월', '금']) // 월~일 순으로 정렬
  assert.equal(rs[0].exercises[0].weight, 45)  // 입력한 무게
  assert.equal(rs[0].exercises[1].weight, 55)  // 기록 무게
  assert.equal(rs[0].exercises[1].restSeconds, 75) // 휴식 없으면 기본값
  assert.equal(rs[0].isActive, true)
  assert.equal(rs[1].exercises[0].weight, 0) // 입력 없으면 0(맨몸 취급)
  assert.ok(rs.every(r => r.exercises.every(e => e.linkedToNext === false)))
  assert.deepEqual(rs.map(r => r.id), ['r0', 'r1'])
  // 잘못된 요일은 버린다
  const odd = buildRoutines(plan.slice(0, 1), { weekdays: [['월', '월요일', 'x']] })
  assert.deepEqual(odd[0].repeatDays, ['월'])
}

// 기본 요일
assert.deepEqual(defaultWeekdays(3), ['월', '수', '금'])
assert.deepEqual(defaultWeekdays(1), ['월'])
assert.equal(defaultWeekdays(7).length, 7)
assert.deepEqual(defaultWeekdays(9), defaultWeekdays(7))

// 저장 프리셋 정리: 알 수 없는 부위·중복·빈 항목·개수 초과 정리
{
  const raw = [
    { id: 'a', name: '  내 분할  ', days: [{ groups: ['가슴', '가슴', '날개', '등'] }, { groups: [] }, { groups: ['하체'] }] },
    { name: '', days: [{ groups: ['가슴'] }] },
    { name: '요일없음', days: [] },
    null,
    'x',
    { name: 'a'.repeat(40), days: [{ groups: ['팔', '코어', '가슴', '등'] }] },
  ]
  const out = sanitizePresets(raw)
  assert.equal(out.length, 2)
  assert.equal(out[0].name, '내 분할')
  assert.deepEqual(out[0].days, [{ groups: ['가슴', '등'] }, { groups: ['하체'] }])
  assert.equal(out[1].name.length, 20)
  assert.deepEqual(out[1].days[0].groups, ['팔', '코어', '가슴']) // 요일당 3개까지
  assert.equal(sanitizePresets(Array.from({ length: 9 }, (_, i) => ({ name: `p${i}`, days: [{ groups: ['가슴'] }] }))).length, MAX_CUSTOM_PRESETS)
  assert.equal(sanitizePresets(Array.from({ length: 1 }, () => ({ name: 'x', days: Array.from({ length: 12 }, () => ({ groups: ['가슴'] })) })))[0].days.length, 7)
  assert.deepEqual(sanitizePresets(undefined), [])
  assert.deepEqual(sanitizePresets('abc'), [])
}

console.log('OK: 분할 루틴 만들기 전부 통과')
