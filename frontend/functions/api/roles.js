// /api/roles — 角色列表/创建，/api/roles/users — 成员角色绑定列表
import { currentUser, isAdmin, isSuperAdmin, json, unauthorized, forbidden, badRequest } from '../_lib/auth.js'
import { handleError } from '../_lib/util.js'

async function formatRole(env, row) {
  const pids = await env.DB.prepare('SELECT permission_id FROM role_permissions WHERE role_id = ?').bind(row.id).all()
  const uc = await env.DB.prepare('SELECT COUNT(*) AS c FROM user_roles WHERE role_id = ?').bind(row.id).first()
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    is_system: !!row.is_system,
    permission_ids: (pids.results || pids).map((r) => r.permission_id),
    user_count: uc ? uc.c : 0
  }
}

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const rows = await env.DB.prepare('SELECT * FROM roles ORDER BY is_system DESC, id').all()
    const out = []
    for (const r of rows.results || rows) out.push(await formatRole(env, r))
    return json(out)
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isSuperAdmin(user)) return forbidden('仅开发者/超级管理员可管理角色')
  try {
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const c = String(body && body.code || '').trim()
    const n = String(body && body.name || '').trim()
    if (!c || !n) return badRequest('缺少角色代码或名称')
    const exists = await env.DB.prepare('SELECT id FROM roles WHERE code = ?').bind(c).first()
    if (exists) return badRequest('角色代码已存在')
    const ids = Array.isArray(body.permission_ids) ? [...new Set(body.permission_ids.map(Number))].filter((v) => Number.isInteger(v) && v > 0) : []
    const info = await env.DB.prepare('INSERT INTO roles (code, name, description, is_system) VALUES (?,?,?,0)')
      .bind(c, n, String(body.description || '').trim()).run()
    const roleId = Number(info.meta.last_row_id)
    const stmt = env.DB.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)')
    for (const pid of ids) await stmt.bind(roleId, pid).run()
    const row = await env.DB.prepare('SELECT * FROM roles WHERE id = ?').bind(roleId).first()
    return json(await formatRole(env, row), 201)
  } catch (e) {
    return handleError(e)
  }
}