// POST /api/matches/:id/staff — 分配工作人员
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../../_lib/auth.js'
import { handleError } from '../../../_lib/util.js'
import { STAFF_ROLES } from '../../../_lib/match.js'

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
    const sid = Number(body.staff_id)
    if (!Number.isInteger(sid) || sid <= 0) return badRequest('请选择工作人员')
    const staff = await env.DB.prepare('SELECT * FROM staff WHERE id = ?').bind(sid).first()
    if (!staff) return notFound('工作人员不存在')
    const r = String(body.role || 'referee')
    if (!STAFF_ROLES.includes(r)) return badRequest('岗位不合法')
    const exists = await env.DB.prepare('SELECT id FROM match_staff WHERE match_id = ? AND staff_id = ? AND role = ?').bind(match.id, sid, r).first()
    if (exists) return badRequest('该工作人员已分配此岗位')
    const info = await env.DB.prepare('INSERT INTO match_staff (match_id, staff_id, role, confirmed, remark) VALUES (?,?,?,?,?)')
      .bind(match.id, sid, r, body.confirmed ? 1 : 0, String(body.remark || '')).run()
    const row = await env.DB.prepare(`
      SELECT ms.*, s.name AS staff_name, s.fanbook_id, s.title AS staff_title, s.user_id AS staff_user_id
      FROM match_staff ms JOIN staff s ON s.id = ms.staff_id WHERE ms.id = ?
    `).bind(info.meta.last_row_id).first()
    return json(row, 201)
  } catch (e) {
    return handleError(e)
  }
}