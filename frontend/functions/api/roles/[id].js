// /api/roles/:id — 修改/删除角色（仅超管）
import { currentUser, isSuperAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../_lib/auth.js'
import { handleError } from '../../_lib/util.js'

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

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isSuperAdmin(user)) return forbidden('仅开发者/超级管理员可管理角色')
  try {
    const row = await env.DB.prepare('SELECT * FROM roles WHERE id = ?').bind(params.id).first()
    if (!row) return notFound('角色不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const name = body.name !== undefined ? String(body.name).trim() : row.name
    if (!name) return badRequest('名称不能为空')
    const ids = Array.isArray(body.permission_ids) ? [...new Set(body.permission_ids.map(Number))].filter((v) => Number.isInteger(v) && v > 0) : []
    await env.DB.prepare('UPDATE roles SET name=?, description=? WHERE id=?').bind(name, String(body.description || '').trim(), row.id).run()
    await env.DB.prepare('DELETE FROM role_permissions WHERE role_id = ?').bind(row.id).run()
    const stmt = env.DB.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)')
    for (const pid of ids) await stmt.bind(row.id, pid).run()
    const updated = await env.DB.prepare('SELECT * FROM roles WHERE id = ?').bind(row.id).first()
    return json(await formatRole(env, updated))
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isSuperAdmin(user)) return forbidden('仅开发者/超级管理员可管理角色')
  try {
    const row = await env.DB.prepare('SELECT * FROM roles WHERE id = ?').bind(params.id).first()
    if (!row) return notFound('角色不存在')
    if (row.is_system) return badRequest('系统内置角色不可删除')
    await env.DB.prepare('DELETE FROM roles WHERE id = ?').bind(row.id).run()
    return json({ message: '角色已删除' })
  } catch (e) {
    return handleError(e)
  }
}