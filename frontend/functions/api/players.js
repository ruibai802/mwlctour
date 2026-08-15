// /api/players — 选手名单列表/新增/批量导入/批量删除/队伍分组
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest } from '../_lib/auth.js'
import { resolveTournamentId, handleError } from '../_lib/util.js'

const FIELDS = ['team', 'name', 'fanbook', 'game_id', 'slot']
const SLOTS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']

function cleanPlayer(body) {
  const p = {}
  for (const f of FIELDS) p[f] = body[f] !== undefined ? String(body[f]).trim() : ''
  return p
}

function validate(p) {
  if (!p.team) return '缺少队伍名'
  if (!p.name && !p.fanbook && !p.game_id) return '至少填写姓名、fanbook 或 ID 之一'
  if (p.slot && !SLOTS.includes(p.slot)) return `身份只能是 ${SLOTS.join('/')}`
  return null
}

async function formatTeamRows(env, tid) {
  const teams = {}
  const rows = await env.DB.prepare('SELECT * FROM players WHERE tournament_id = ? ORDER BY team, id').bind(tid).all()
  for (const r of rows.results || rows) {
    if (!teams[r.team]) teams[r.team] = { team: r.team, players: [] }
    teams[r.team].players.push(r)
  }
  return Object.values(teams)
}

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const url = new URL(request.url)
    const tid = await resolveTournamentId(request, env)

    // GET /api/players/teams
    if (url.pathname.endsWith('/teams')) {
      return json(await formatTeamRows(env, tid))
    }

    const team = url.searchParams.get('team')
    const slot = url.searchParams.get('slot')
    let rows
    if (team && slot) {
      rows = await env.DB.prepare('SELECT * FROM players WHERE team = ? AND slot = ? AND tournament_id = ? ORDER BY id').bind(String(team), String(slot), tid).all()
    } else if (team) {
      rows = await env.DB.prepare('SELECT * FROM players WHERE team = ? AND tournament_id = ? ORDER BY slot, id').bind(String(team), tid).all()
    } else if (slot) {
      rows = await env.DB.prepare('SELECT * FROM players WHERE slot = ? AND tournament_id = ? ORDER BY team, id').bind(String(slot), tid).all()
    } else {
      rows = await env.DB.prepare('SELECT * FROM players WHERE tournament_id = ? ORDER BY team, slot, id').bind(tid).all()
    }
    return json(rows.results || rows)
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  const url = new URL(request.url)

  // POST /api/players/import
  if (url.pathname.endsWith('/import')) {
    let list
    try { list = await request.json() } catch (e) { list = null }
    if (!Array.isArray(list) || !list.length) return badRequest('导入数据不能为空')
    if (list.length > 2000) return badRequest('单次最多导入 2000 条')
    const tid = await resolveTournamentId(request, env)
    const stmt = env.DB.prepare('INSERT INTO players (team, name, fanbook, game_id, slot, tournament_id) VALUES (?,?,?,?,?,?)')
    let inserted = 0
    let skipped = 0
    for (const item of list) {
      const p = cleanPlayer(item)
      if (validate(p)) { skipped++; continue }
      await stmt.bind(p.team, p.name, p.fanbook, p.game_id, p.slot, tid).run()
      inserted++
    }
    return json({ message: `导入完成：新增 ${inserted} 条，跳过 ${skipped} 条`, inserted, skipped })
  }

  // POST /api/players/batch-delete
  if (url.pathname.endsWith('/batch-delete')) {
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const ids = Array.isArray(body && body.ids) ? body.ids : []
    if (!ids.length) return badRequest('请选择要删除的选手')
    const cleanIds = [...new Set(ids.map(Number))].filter((n) => Number.isInteger(n) && n > 0)
    if (!cleanIds.length) return badRequest('选手ID不合法')
    const tid = await resolveTournamentId(request, env)
    let deleted = 0
    const del = env.DB.prepare('DELETE FROM players WHERE id = ? AND tournament_id = ?')
    for (const id of cleanIds) {
      const info = await del.bind(id, tid).run()
      deleted += info.meta.changes
    }
    return json({ message: `已删除 ${deleted} 名选手`, deleted })
  }

  // POST /api/players
  let body
  try { body = await request.json() } catch (e) { body = {} }
  const p = cleanPlayer(body)
  const err = validate(p)
  if (err) return badRequest(err)
  const info = await env.DB.prepare('INSERT INTO players (team, name, fanbook, game_id, slot, tournament_id) VALUES (?,?,?,?,?,?)')
    .bind(p.team, p.name, p.fanbook, p.game_id, p.slot, await resolveTournamentId(request, env)).run()
  const row = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(info.meta.last_row_id).first()
  return json(row, 201)
}
