// PUT /api/roles/users/:id — 设置成员的 RBAC 角色（全量覆盖，仅超管）
import { currentUser, isSuperAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../../_lib/auth.js'
import { handleError } from '../../../_lib/util.js'

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isSuperAdmin(user)) return forbidden('仅开发者/超级管理员可管理角色分配')
  try {
    const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(params.id).first()
    if (!target) return notFound('成员不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const roleIds = body && Array.isArray(body.role_ids) ? body.role_ids : null
    if (roleIds === null) return badRequest('role_ids 必须是数组')
    const cleanIds = [...new Set(roleIds.map(Number))].filter((v) => Number.isInteger(v) && v > 0)
    await env.DB.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(target.id).run()
    const stmt = env.DB.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)')
    for (const rid of cleanIds) await stmt.bind(target.id, rid).run()
    const rows = await env.DB.prepare('SELECT role_id FROM user_roles WHERE user_id = ?').bind(target.id).all()
    return json({
      id: target.id,
      fanbook_id: target.fanbook_id,
      name: target.name,
      role_ids: (rows.results || rows).map((r) => r.role_id)
    })
  } catch (e) {
    return handleError(e)
  }
}