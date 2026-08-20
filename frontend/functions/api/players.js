// /api/players — 选手名单列表(GET) / 新增(POST)
// 子路径 teams/import/batch-delete 见独立文件
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

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const url = new URL(request.url)
    const tid = await resolveTournamentId(request, env)
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
  try {
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const p = cleanPlayer(body)
    const err = validate(p)
    if (err) return badRequest(err)
    const info = await env.DB.prepare('INSERT INTO players (team, name, fanbook, game_id, slot, tournament_id) VALUES (?,?,?,?,?,?)')
      .bind(p.team, p.name, p.fanbook, p.game_id, p.slot, await resolveTournamentId(request, env)).run()
    const row = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(row, 201)
  } catch (e) {
    return handleError(e)
  }
}
