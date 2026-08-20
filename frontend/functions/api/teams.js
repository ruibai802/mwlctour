// /api/teams — 队伍列表/新增
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest } from '../_lib/auth.js'
import { resolveTournamentId, handleError } from '../_lib/util.js'

export async function formatTeam(env, row, withPlayers = false) {
  const players = await env.DB.prepare(`
    SELECT tp.id AS team_player_id, tp.slot, tp.remark AS tp_remark,
           p.id AS player_id, p.team, p.name, p.fanbook, p.game_id, p.slot AS player_slot
    FROM team_players tp JOIN players p ON p.id = tp.player_id
    WHERE tp.team_id = ? ORDER BY tp.slot, p.id
  `).bind(row.id).all()
  const pcs = await env.DB.prepare('SELECT COUNT(*) AS c FROM team_players WHERE team_id = ?').bind(row.id).first()
  return { ...row, player_count: pcs ? pcs.c : 0, players: withPlayers ? (players.results || players) : undefined }
}

function cleanTeam(body) {
  const t = {}
  t.name = body.name !== undefined ? String(body.name).trim() : ''
  t.short_name = body.short_name !== undefined ? String(body.short_name).trim() : ''
  t.logo = body.logo !== undefined ? String(body.logo).trim() : ''
  t.captain = body.captain !== undefined ? String(body.captain).trim() : ''
  t.color = body.color !== undefined ? String(body.color).trim() : ''
  t.sort = parseInt(body.sort, 10) || 0
  t.status = body.status !== undefined && ['active', 'inactive'].includes(String(body.status).trim()) ? String(body.status).trim() : 'active'
  t.remark = body.remark !== undefined ? String(body.remark).trim() : ''
  return t
}

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const tid = await resolveTournamentId(request, env)
    const rows = await env.DB.prepare('SELECT * FROM teams WHERE tournament_id = ? ORDER BY sort, id').bind(tid).all()
    const out = []
    for (const r of rows.results || rows) out.push(await formatTeam(env, r, true))
    return json(out)
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
    const t = cleanTeam(body)
    if (!t.name) return badRequest('缺少队伍名称')
    const tid = await resolveTournamentId(request, env)
    const exists = await env.DB.prepare('SELECT id FROM teams WHERE tournament_id = ? AND name = ?').bind(tid, t.name).first()
    if (exists) return badRequest('已存在同名队伍')
    const info = await env.DB.prepare(
      'INSERT INTO teams (tournament_id, name, short_name, logo, captain, color, sort, status, remark) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(tid, t.name, t.short_name, t.logo, t.captain, t.color, t.sort, t.status, t.remark).run()
    const row = await env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(await formatTeam(env, row), 201)
  } catch (e) {
    return handleError(e)
  }
}