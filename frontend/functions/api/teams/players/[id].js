// PUT/DELETE /api/teams/players/:id — 修改队员位置/移出队伍
import { currentUser, isAdmin, json, unauthorized, forbidden, notFound } from '../../../_lib/auth.js'
import { handleError } from '../../../_lib/util.js'

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const tp = await env.DB.prepare('SELECT * FROM team_players WHERE id = ?').bind(params.id).first()
    if (!tp) return notFound('队伍队员不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    await env.DB.prepare('UPDATE team_players SET slot=?, remark=? WHERE id=?').bind(
      body.slot !== undefined ? String(body.slot).trim() : tp.slot,
      body.remark !== undefined ? String(body.remark).trim() : tp.remark,
      tp.id
    ).run()
    const row = await env.DB.prepare(`
      SELECT tp.id AS team_player_id, tp.slot, tp.remark AS tp_remark,
             p.id AS player_id, p.team, p.name, p.fanbook, p.game_id, p.slot AS player_slot
      FROM team_players tp JOIN players p ON p.id = tp.player_id WHERE tp.id = ?
    `).bind(tp.id).first()
    return json(row)
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
    const info = await env.DB.prepare('DELETE FROM team_players WHERE id = ?').bind(params.id).run()
    if (!info.meta.changes) return notFound('队伍队员不存在')
    return json({ message: '已移出队伍' })
  } catch (e) {
    return handleError(e)
  }
}