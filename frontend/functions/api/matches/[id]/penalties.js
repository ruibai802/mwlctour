// POST /api/matches/:id/penalties — 添加罚单
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../../_lib/auth.js'
import { handleError } from '../../../_lib/util.js'
import { PENALTY_TYPES } from '../../../_lib/match.js'

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
    const t = String(body.type || 'warning')
    if (!PENALTY_TYPES.includes(t)) return badRequest('罚单类型不合法')
    if (body.team_id !== undefined && Number(body.team_id) > 0) {
      const tm = await env.DB.prepare('SELECT id FROM teams WHERE id = ?').bind(Number(body.team_id)).first()
      if (!tm) return notFound('队伍不存在')
    }
    const info = await env.DB.prepare(`
      INSERT INTO penalties (match_id, team_id, player_id, type, reason, amount, points_deduct, status, created_by)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(
      match.id,
      body.team_id !== undefined && Number(body.team_id) > 0 ? Number(body.team_id) : null,
      body.player_id !== undefined && Number(body.player_id) > 0 ? Number(body.player_id) : null,
      t,
      String(body.reason || '').trim(),
      Number(body.amount) || 0,
      parseInt(body.points_deduct, 10) || 0,
      String(body.status || 'pending'),
      String(user.name || user.fanbook_id)
    ).run()
    const row = await env.DB.prepare(`
      SELECT pn.*, tm.name AS team_name, pl.name AS player_name
      FROM penalties pn LEFT JOIN teams tm ON tm.id = pn.team_id LEFT JOIN players pl ON pl.id = pn.player_id
      WHERE pn.id = ?
    `).bind(info.meta.last_row_id).first()
    return json(row, 201)
  } catch (e) {
    return handleError(e)
  }
}