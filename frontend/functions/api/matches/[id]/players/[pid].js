// PUT/DELETE /api/matches/:id/players/:pid — 修改出场选手/移除
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../../../_lib/auth.js'
import { handleError } from '../../../../_lib/util.js'
import { PLAYER_SIDES } from '../../../../_lib/match.js'

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const row = await env.DB.prepare('SELECT * FROM match_players WHERE id = ? AND match_id = ?').bind(params.pid, params.id).first()
    if (!row) return notFound('出场记录不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    if (body.side !== undefined && !PLAYER_SIDES.includes(String(body.side).toLowerCase())) return badRequest('阵营不合法')
    if (body.team_id !== undefined && body.team_id !== null && Number(body.team_id) > 0) {
      const t = await env.DB.prepare('SELECT id FROM teams WHERE id = ?').bind(Number(body.team_id)).first()
      if (!t) return notFound('队伍不存在')
    }
    await env.DB.prepare('UPDATE match_players SET side=?, slot=?, team_id=?, confirmed=?, remark=? WHERE id=?').bind(
      body.side !== undefined ? String(body.side).toLowerCase() : row.side,
      body.slot !== undefined ? String(body.slot).trim() : row.slot,
      body.team_id !== undefined && Number(body.team_id) > 0 ? Number(body.team_id) : row.team_id,
      body.confirmed !== undefined ? (body.confirmed ? 1 : 0) : row.confirmed,
      body.remark !== undefined ? String(body.remark).trim() : row.remark,
      row.id
    ).run()
    const updated = await env.DB.prepare(`
      SELECT mp.*, p.name AS player_name, p.fanbook, p.game_id, p.slot AS player_slot, t.name AS team_name
      FROM match_players mp
      JOIN players p ON p.id = mp.player_id
      LEFT JOIN teams t ON t.id = mp.team_id
      WHERE mp.id = ?
    `).bind(row.id).first()
    return json(updated)
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const info = await env.DB.prepare('DELETE FROM match_players WHERE id = ? AND match_id = ?').bind(params.pid, params.id).run()
    if (!info.meta.changes) return notFound('出场记录不存在')
    return json({ message: '已移除出场选手' })
  } catch (e) {
    return handleError(e)
  }
}