// PUT/DELETE /api/matches/:id/staff/:sid — 修改分配（确认）/移除分配
import { currentUser, json, unauthorized, forbidden, badRequest, notFound } from '../../../../_lib/auth.js'
import { hasPerm } from '../../../../_lib/rbac.js'
import { handleError } from '../../../../_lib/util.js'
import { STAFF_ROLES } from '../../../../_lib/match.js'

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const sid = Number(params.sid)
    if (!Number.isInteger(sid) || sid <= 0) return badRequest('参数不合法')
    const row = await env.DB.prepare('SELECT * FROM match_staff WHERE id = ? AND match_id = ?').bind(sid, params.id).first()
    if (!row) return notFound('分配记录不存在')
    const selfStaff = await env.DB.prepare('SELECT id FROM staff WHERE id = ? AND user_id = ?').bind(row.staff_id, user.id).first()
    const isAdminUser = ['superadmin', 'admin'].includes(user.role)
    if (!isAdminUser && !(selfStaff && await hasPerm(env, user, 'match:confirm'))) {
      return forbidden('无权限修改该分配')
    }
    let body
    try { body = await request.json() } catch (e) { body = {} }
    if (body.role !== undefined && !isAdminUser) return forbidden('仅管理员可调整岗位')
    if (body.role !== undefined && !STAFF_ROLES.includes(String(body.role))) return badRequest('岗位不合法')
    await env.DB.prepare('UPDATE match_staff SET role=?, confirmed=?, remark=? WHERE id=?').bind(
      body.role !== undefined ? String(body.role) : row.role,
      body.confirmed !== undefined ? (body.confirmed ? 1 : 0) : row.confirmed,
      body.remark !== undefined ? String(body.remark).trim() : row.remark,
      row.id
    ).run()
    const updated = await env.DB.prepare(`
      SELECT ms.*, s.name AS staff_name, s.fanbook_id, s.title AS staff_title, s.user_id AS staff_user_id
      FROM match_staff ms JOIN staff s ON s.id = ms.staff_id WHERE ms.id = ?
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
  if (!['superadmin', 'admin'].includes(user.role)) return forbidden()
  try {
    const info = await env.DB.prepare('DELETE FROM match_staff WHERE id = ? AND match_id = ?').bind(params.sid, params.id).run()
    if (!info.meta.changes) return notFound('分配记录不存在')
    return json({ message: '已移除分配' })
  } catch (e) {
    return handleError(e)
  }
}