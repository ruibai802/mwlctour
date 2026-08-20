// POST /api/members/batch-delete — 批量删除成员
import { currentUser, isAdmin, isSuperAdmin, json, unauthorized, forbidden, badRequest } from '../../_lib/auth.js'
import { handleError } from '../../_lib/util.js'

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const ids = Array.isArray(body && body.ids) ? body.ids : []
    if (!ids.length) return badRequest('请选择要删除的成员')
    const cleanIds = [...new Set(ids.map(Number))].filter((n) => Number.isInteger(n) && n > 0)
    if (!cleanIds.length) return badRequest('成员ID不合法')
    const rows = await env.DB.prepare('SELECT * FROM users WHERE id IN (' + cleanIds.map(() => '?').join(',') + ')').bind(...cleanIds).all()
    const list = rows.results || rows
    const hasSuperAdmin = list.some((r) => r.role === 'superadmin')
    if (hasSuperAdmin && !isSuperAdmin(user)) return forbidden('仅开发者/超级管理员可删除超管账号')
    const deletable = list.filter((r) => String(r.fanbook_id) !== '1000000').map((r) => r.id)
    let deleted = 0
    const del = env.DB.prepare('DELETE FROM users WHERE id = ?')
    for (const id of deletable) {
      const info = await del.bind(id).run()
      deleted += info.meta.changes
    }
    return json({ message: `已删除 ${deleted} 人（初始主办账号不可删除）`, deleted })
  } catch (e) {
    return handleError(e)
  }
}
