// POST /api/matches/:id/players — 添加出场选手
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../../_lib/auth.js'
import { handleError } from '../../../_lib/util.js'
import { PLAYER_SIDES } from '../../../_lib/match.js'

export async function onRequestPost(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const match = await env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(params.id).first()
    if (!match) return notFound('比赛不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const pid = Number(body.player_id)
    if (!Number.isInteger(pid) || pid <= 0) return badRequest('请选择选手')
    const player = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(pid).first()
    if (!player) return notFound('选手不存在')
    const sd = String(body.side || 'a').toLowerCase()
    if (!PLAYER_SIDES.includes(sd)) return badRequest('阵营不合法')
    let tid = body.team_id !== undefined && Number(body.team_id) > 0 ? Number(body.team_id) : null
    if (tid === null) {
      const tp = await env.DB.prepare('SELECT team_id FROM team_players WHERE player_id = ? LIMIT 1').bind(pid).first()
      if (tp) tid = tp.team_id
      else tid = sd === 'a' ? match.team_a_id : match.team_b_id
    }
    if (tid !== null) {
      const t = await env.DB.prepare('SELECT id FROM teams WHERE id = ?').bind(tid).first()
      if (!t) return notFound('队伍不存在')
    }
    const exists = await env.DB.prepare('SELECT id FROM match_players WHERE match_id = ? AND player_id = ?').bind(match.id, pid).first()
    if (exists) return badRequest('该选手已在出场名单中')
    const info = await env.DB.prepare(
      'INSERT INTO match_players (match_id, player_id, team_id, side, slot, confirmed, remark) VALUES (?,?,?,?,?,?,?)'
    ).bind(
      match.id,
      pid,
      tid,
      sd,
      String(body.slot || '').trim(),
      body.confirmed ? 1 : 0,
      String(body.remark || '').trim()
    ).run()
    const row = await env.DB.prepare(`
      SELECT mp.*, p.name AS player_name, p.fanbook, p.game_id, p.slot AS player_slot, t.name AS team_name
      FROM match_players mp
      JOIN players p ON p.id = mp.player_id
      LEFT JOIN teams t ON t.id = mp.team_id
      WHERE mp.id = ?
    `).bind(info.meta.last_row_id).first()
    return json(row, 201)
  } catch (e) {
    return handleError(e)
  }
}