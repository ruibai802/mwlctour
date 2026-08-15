// Pages Functions 冒烟测试：用本地 SQLite 模拟 D1，验证登录/鉴权/建日程全链路
// 运行: node --experimental-sqlite test-functions.mjs
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.JWT_SECRET = 'test-secret-for-smoke'

// 1) 建内存库并执行迁移
const sqlite = new DatabaseSync(':memory:')
sqlite.exec(readFileSync(join(__dirname, 'migrations', '0001_init.sql'), 'utf8'))

// 2) D1 兼容适配层
const DB = {
  prepare(sql) {
    const stmt = sqlite.prepare(sql)
    return {
      bind(...args) {
        return {
          async run() { const r = stmt.run(...args); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } } },
          async all() { return { results: stmt.all(...args) } },
          async first() { return stmt.get(...args) ?? null }
        }
      },
      async run() { const r = stmt.run(); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } } },
      async all() { return { results: stmt.all() } },
      async first() { return stmt.get() ?? null }
    }
  },
  async batch(stmts) { for (const s of stmts) await s.run(); return [] }
}

// 3) 模拟 R2
const r2store = new Map()
const UPLOADS = {
  put: async (key, stream, meta) => { r2store.set(key, { meta }); return {} },
  get: async (key) => r2store.get(key) ? { body: new ReadableStream(), httpMetadata: r2store.get(key).meta?.httpMetadata } : null,
  head: async (key) => r2store.get(key) ? { httpMetadata: r2store.get(key).meta?.httpMetadata } : null,
  delete: async (key) => { r2store.delete(key); return {} }
}

const env = { DB, UPLOADS }

function makeRequest(method, url, { token, body, headers = {} } = {}) {
  const h = new Headers(headers)
  if (token) h.set('Authorization', `Bearer ${token}`)
  let payload
  if (body !== undefined) {
    h.set('Content-Type', 'application/json')
    payload = JSON.stringify(body)
  }
  return new Request(url, { method, headers: h, body: payload })
}

let failed = 0
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}${extra ? '  [' + extra + ']' : ''}`)
  if (!cond) failed++
}

// 4) 登录
const authMod = await import('./functions/api/auth.js')
const loginRes = await authMod.onRequestPost({ request: makeRequest('POST', 'https://x.pages.dev/api/auth/login', { body: { fanbook_id: '1000000', password: 'MWLC123456' } }), env })
const loginData = await loginRes.json()
check('login 200', loginRes.status === 200, `status=${loginRes.status}`)
check('login returns token', !!loginData.token)
check('login user superadmin', loginData.user && loginData.user.role === 'superadmin', loginData.user?.name)
const token = loginData.token

// 5) 错误密码
const badRes = await authMod.onRequestPost({ request: makeRequest('POST', 'https://x.pages.dev/api/auth/login', { body: { fanbook_id: '1000000', password: 'wrong' } }), env })
check('wrong password 401', badRes.status === 401)

// 6) /api/auth/me
const meRes = await authMod.onRequestGet({ request: makeRequest('GET', 'https://x.pages.dev/api/auth/me', { token }), env })
const meData = await meRes.json()
check('me 200 with user', meRes.status === 200 && meData.user && meData.user.fanbook_id === '1000000')

// 7) 无 token 401
const noAuth = await authMod.onRequestGet({ request: makeRequest('GET', 'https://x.pages.dev/api/auth/me'), env })
check('me without token 401', noAuth.status === 401)

// 8) 建日程（admin）
const schedMod = await import('./functions/api/schedules.js')
const schedRes = await schedMod.onRequestPost({
  request: makeRequest('POST', 'https://x.pages.dev/api/schedules', { token, headers: { 'X-Tournament-Id': '1' }, body: { group_name: 'A', round: 1, seq: 1, matchup: 'T1 vs T2', time: '2026-08-15 12:00' } }),
  env
})
const schedData = await schedRes.json()
check('create schedule 201', schedRes.status === 201, `status=${schedRes.status} ${JSON.stringify(schedData).slice(0, 120)}`)
check('schedule has tag', typeof schedData.tags === 'string' && schedData.tags.includes('创建于'))
const sid = schedData.id

// 9) 日程列表
const listRes = await schedMod.onRequestGet({ request: makeRequest('GET', 'https://x.pages.dev/api/schedules', { token, headers: { 'X-Tournament-Id': '1' } }), env })
const listData = await listRes.json()
check('schedule list 200', listRes.status === 200 && Array.isArray(listData) && listData.length === 1)
check('schedule result null + arrays', listData[0] && listData[0].result === null && Array.isArray(listData[0].team_a_lineup))

// 10) 上传结果（模拟 multipart：无截图）
const resultMod = await import('./functions/api/results.js')
const fd = new FormData()
fd.append('schedule_id', String(sid))
fd.append('score', '2:1')
fd.append('winner', 'T1')
fd.append('referee_id', '1000000')
fd.append('recorder_id', '1000000')
fd.append('remark', 'ok')
const resRes = await resultMod.onRequestPost({
  request: new Request('https://x.pages.dev/api/results', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Tournament-Id': '1' }, body: fd }),
  env
})
const resData = await resRes.json()
check('create result 201', resRes.status === 201, `status=${resRes.status} ${JSON.stringify(resData).slice(0, 120)}`)

// 11) 日程再查 → completed + 数组字段
const list2 = await schedMod.onRequestGet({ request: makeRequest('GET', 'https://x.pages.dev/api/schedules', { token, headers: { 'X-Tournament-Id': '1' } }), env })
const list2Data = await list2.json()
check('schedule completed', list2Data[0].status === 'completed')
check('result.game_links is array', Array.isArray(list2Data[0].result.game_links))

// 12) 缺链接查询
const mlMod = await import('./functions/api/schedules/missing-links.js')
const mlRes = await mlMod.onRequestGet({ request: makeRequest('GET', 'https://x.pages.dev/api/schedules/missing-links', { token, headers: { 'X-Tournament-Id': '1' } }), env })
const mlData = await mlRes.json()
check('missing-links total=1', mlData.total === 1, `total=${mlData.total}`)

// 13) 加视频链接
const linksMod = await import('./functions/api/results/[id]/links.js')
const linksRes = await linksMod.onRequestPut({
  request: makeRequest('PUT', `https://x.pages.dev/api/results/${resData.id}/links`, { token, body: { game_links: ['https://v.qq.com/x/1'] } }),
  env, params: { id: resData.id }
})
const linksData = await linksRes.json()
check('add links ok', linksRes.status === 200 && linksData.game_links.length === 1)

// 14) 成员创建 + 身份清空
const memberMod = await import('./functions/api/members.js')
const memRes = await memberMod.onRequestPost({
  request: makeRequest('POST', 'https://x.pages.dev/api/members', { token, body: { fanbook_id: '99990002', name: 'T2', titles: ['裁判/录像'], role: 'official' } }),
  env
})
const memData = await memRes.json()
check('create member 201', memRes.status === 201, memData.title)
const memberIdMod = await import('./functions/api/members/[id].js')
const memUpdRes = await memberIdMod.onRequestPut({
  request: makeRequest('PUT', `https://x.pages.dev/api/members/${memData.id}`, { token, body: { name: 'T2', titles: [], role: 'official' } }),
  env, params: { id: memData.id }
})
const memUpd = await memUpdRes.json()
check('member titles cleared', memUpd.title === '', JSON.stringify(memUpd.title))

// 15) 赛事详情（公开）
const tournMod = await import('./functions/api/tournaments/[param].js')
const tRes = await tournMod.onRequestGet({ request: makeRequest('GET', 'https://x.pages.dev/api/tournaments/default'), env, params: { param: 'default' } })
const tData = await tRes.json()
check('tournament detail public', tRes.status === 200 && tData.code === 'default')

console.log('----')
if (failed) { console.log(`${failed} TEST(S) FAILED`); process.exit(1) }
console.log('ALL FUNCTIONS SMOKE TESTS PASSED')
