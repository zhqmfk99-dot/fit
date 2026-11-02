// supabase/setup_all.sql 만들기: node scripts/build-sql.mjs   (npm run sql:build)
// 최신인지 확인만:               node scripts/build-sql.mjs --check   (npm run sql:check, 다르면 종료 코드 1)
import fs from 'node:fs'
import { buildSetupSql, SETUP_FILE } from './sqlOrder.mjs'

const dir = new URL('../supabase/', import.meta.url)
const built = buildSetupSql(name => fs.readFileSync(new URL(name, dir), 'utf8'))
const target = new URL(SETUP_FILE, dir)
const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : null

if (process.argv.includes('--check')) {
  if (current !== built) {
    console.error(`supabase/${SETUP_FILE}이 최신이 아니에요. \`npm run sql:build\`로 다시 만들어 주세요.`)
    process.exit(1)
  }
  console.log(`OK: supabase/${SETUP_FILE}이 최신이에요.`)
} else {
  fs.writeFileSync(target, built)
  console.log(`supabase/${SETUP_FILE}을 만들었어요(${(built.length / 1024).toFixed(1)}KB, ${built.split('\n').length}줄).`)
}
