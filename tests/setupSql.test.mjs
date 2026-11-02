import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SETUP_ORDER, NOT_IN_SETUP, SETUP_FILE, buildSetupSql } from '../scripts/sqlOrder.mjs'

const dir = new URL('../supabase/', import.meta.url)
const read = name => fs.readFileSync(new URL(name, dir), 'utf8')

// supabase 폴더의 모든 .sql 파일은 순서 목록에 있거나, 빼는 이유가 적혀 있어야 한다(새 SQL을 추가하고 순서에 넣는 걸 잊으면 실패)
{
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  const known = new Set([...SETUP_ORDER, ...Object.keys(NOT_IN_SETUP)])
  assert.deepEqual(files.filter(f => !known.has(f)), [], 'scripts/sqlOrder.mjs의 SETUP_ORDER(또는 NOT_IN_SETUP)에 넣어 주세요')
  assert.deepEqual([...known].filter(f => !files.includes(f)), [], '목록에 있는데 파일이 없어요')
  assert.equal(new Set(SETUP_ORDER).size, SETUP_ORDER.length, '순서 목록에 같은 파일이 두 번 있어요')
}

// 순서 제약: 앞 파일이 만든 것을 뒤 파일이 덮어쓰는 쌍
{
  const at = n => SETUP_ORDER.indexOf(n)
  assert.ok(at('schema.sql') < at('auth_profiles.sql'))
  assert.ok(at('auth_profiles.sql') < at('profile_fields.sql'))
  assert.ok(at('profile_fields.sql') < at('body_records.sql'))
  assert.ok(at('seed_exercises.sql') < at('unilateral.sql'), 'unilateral.sql은 seed_exercises.sql의 가입 트리거 함수를 덮어쓰므로 뒤에')
  assert.ok(at('auth_profiles.sql') < at('auth_rate_limit.sql'), 'auth_rate_limit.sql은 auth_profiles.sql의 함수를 덮어쓰므로 뒤에')
}

// 결과 파일(setup_all.sql)이 최신이다: 개별 파일을 고치고 sql:build를 안 돌렸으면 실패
{
  const built = buildSetupSql(read)
  const current = read(SETUP_FILE).replace(/\r\n/g, '\n')
  assert.equal(current, built, `supabase/${SETUP_FILE}이 최신이 아니에요. npm run sql:build 로 다시 만들어 주세요.`)
  // 각 파일의 내용이 빠짐없이 들어 있고 순서대로다
  let from = 0
  for (const name of SETUP_ORDER) {
    const i = built.indexOf(`-- ${name}\n`, from)
    assert.ok(i >= from, `${name}이 순서대로 들어 있지 않아요`)
    from = i
  }
}

// 모든 SQL 파일은 "여러 번 실행해도 안전"하다고 밝혀야 한다(한 번에 실행하는 파일이 안전하려면 개별 파일이 다 그래야 한다) — 위험한 문장이 들어 있지 않은지 훑는다
{
  for (const name of SETUP_ORDER) {
    const text = read(name)
    const code = text.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    assert.doesNotMatch(code, /\bdrop\s+table\b/i, `${name}: drop table이 있어요(데이터가 지워질 수 있음)`)
    assert.doesNotMatch(code, /\btruncate\b/i, `${name}: truncate가 있어요`)
    assert.doesNotMatch(code, /\bcreate\s+table\s+(?!if\s+not\s+exists)/i, `${name}: create table if not exists가 아니에요`)
    assert.doesNotMatch(code, /\bcreate\s+(unique\s+)?index\s+(?!if\s+not\s+exists)/i, `${name}: create index if not exists가 아니에요`)
    // create policy는 바로 앞에 같은 이름의 drop policy if exists가 있어야 한다
    for (const m of code.matchAll(/create\s+policy\s+("[^"]+")\s+on\s+([\w.]+)/gi)) {
      assert.match(code, new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+${m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+on\\s+${m[2].replace('.', '\\.')}`, 'i'), `${name}: ${m[1]} on ${m[2]} 앞에 drop policy if exists가 없어요`)
    }
  }
}

console.log('OK: SQL 한 번에 실행 파일 규칙 통과')
