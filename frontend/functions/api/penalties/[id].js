// PUT/DELETE /api/penalties/:id — 修改/判定罚单、删除
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../_lib/auth.js'
import { handleError } from '../../_lib/util.js'
import { PENALTY_TYPES, PENALTY_STATUS } from '../../_lib/match.js'

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const row = await env.DB.prepare('SELECT * FROM penalties WHERE id = ?').bind(params.id).first()
    if (!row) return notFound('罚单不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    if (body.type !== undefined && !PENALTY_TYPES.includes(String(body.type))) return badRequest('罚单类型不合法')
    if (body.status !== undefined && !PENALTY_STATUS.includes(String(body.status))) return badRequest('罚单状态不合法')
    await env.DB.prepare(`
      UPDATE penalties SET team_id=?, player_id=?, type=?, reason=?, amount=?, points_deduct=?, status=?,
        decided_by=?, decided_at=?, remark=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).bind(
      body.team_id !== undefined && Number(body.team_id) > 0 ? Number(body.team_id) : null,
      body.player_id !== undefined && Number(body.player_id) > 0 ? Number(body.player_id) : null,
      body.type !== undefined ? String(body.type) : row.type,
      body.reason !== undefined ? String(body.reason).trim() : row.reason,
      body.amount !== undefined ? Number(body.amount) || 0 : row.amount,
      body.points_deduct !== undefined ? parseInt(body.points_deduct, 10) || 0 : row.points_deduct,
      body.status !== undefined ? String(body.status) : row.status,
      body.decided_by !== undefined ? String(body.decided_by).trim() : row.decided_by,
      body.decided_at !== undefined ? String(body.decided_at).trim() : row.decided_at,
      body.remark !== undefined ? String(body.remark).trim() : row.remark,
      row.id
    ).run()
    const updated = await env.DB.prepare(`
      SELECT pn.*, tm.name AS team_name, pl.name AS player_name
      FROM penalties pn LEFT JOIN teams tm ON tm.id = pn.team_id LEFT JOIN players pl ON pl.id = pn.player_id
      WHERE pn.id = ?
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
    const info = await env.DB.prepare('DELETE FROM penalties WHERE id = ?').bind(params.id).run()
    if (!info.meta.changes) return notFound('罚单不存在')
    return json({ message: '罚单已删除' })
  } catch (e) {
    return handleError(e)
  }
}