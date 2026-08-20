// GET /api/roles/users — 成员与 RBAC 角色绑定列表（仅超管；静态段优先于 roles/[id].js）
import { currentUser, isSuperAdmin, json, unauthorized, forbidden } from '../../_lib/auth.js'
import { handleError } from '../../_lib/util.js'

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isSuperAdmin(user)) return forbidden('仅开发者/超级管理员可管理角色分配')
  try {
    const users = await env.DB.prepare('SELECT * FROM users ORDER BY id').all()
    const out = []
    for (const u of users.results || users) {
      const roleRows = await env.DB.prepare('SELECT role_id FROM user_roles WHERE user_id = ?').bind(u.id).all()
      out.push({
        id: u.id,
        fanbook_id: u.fanbook_id,
        name: u.name,
        title: u.title,
        role: u.role,
        role_ids: (roleRows.results || roleRows).map((r) => r.role_id)
      })
    }
    return json(out)
  } catch (e) {
    return handleError(e)
  }
}