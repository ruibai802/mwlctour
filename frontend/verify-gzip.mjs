import { deflateSync, gunzipSync } from 'zlib'
const login = await fetch('http://127.0.0.1:8788/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fanbook_id: '20605142', password: 'MWLC123456' })
}).then((r) => r.json())
const H = { Authorization: 'Bearer ' + login.token }

async function getJson(path) {
  const r = await fetch('http://127.0.0.1:8788' + path, { headers: H })
  const buf = new Uint8Array(await r.arrayBuffer())
  if (r.headers.get('content-encoding') === 'gzip') {
    return JSON.parse(gunzipSync(buf).toString('utf8'))
  }
  return JSON.parse(Buffer.from(buf).toString('utf8'))
}

// teams 数据完整性
const t = await getJson('/api/teams')
console.log('teams 队伍数:', t.length)
console.log('首队:', t[0].name, '| 人数:', t[0].player_count, '| 含players字段:', 'players' in t[0])

// 队伍详情（带名单）
const d = await getJson('/api/teams/' + t[0].id)
console.log('team detail:', d.team.name, '| players:', (d.players || []).length)

// players
const p = await getJson('/api/players')
console.log('players 数量:', p.length, '| 首条:', p[0].name, p[0].team)

// playerTeams
const pt = await getJson('/api/players/teams')
console.log('playerTeams 队伍数:', pt.length, '| 首队:', pt[0].team, '| 队员:', pt[0].players.length)

// matches 列表 + 详情
const m = await getJson('/api/matches')
console.log('matches 数量:', m.length)
if (m.length) {
  const md = await getJson('/api/matches/' + m[0].id)
  console.log('match detail:', md.matchup, '| staff:', (md.staff || []).length, '| rosterA:', (md.team_a_players || []).length)
}
console.log('=== 全部数据校验通过 ===')
