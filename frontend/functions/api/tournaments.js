// /api/tournaments — 赛事列表/创建
import { currentUser, canEditRules, json, unauthorized, forbidden, badRequest } from '../_lib/auth.js'
import { handleError } from '../_lib/util.js'

export async function onRequestGet(context) {
  const { env } = context
  try {
    const rows = await env.DB.prepare('SELECT id, code, name, description FROM tournaments ORDER BY id').all()
    return json(rows.results || rows)
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!canEditRules(user)) return forbidden('仅规则管理/管理员可创建赛事')
  try {
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const { code, name, description } = body || {}
    const c = String(code || '').trim()
    if (!c) return badRequest('请输入赛事代码（英文/数字）')
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(c)) return badRequest('赛事代码只能包含字母、数字、下划线或短横线')
    const exists = await env.DB.prepare('SELECT id FROM tournaments WHERE code = ?').bind(c).first()
    if (exists) return badRequest('该赛事代码已存在')
    const info = await env.DB.prepare(
      'INSERT INTO tournaments (code, name, description, created_by) VALUES (?,?,?,?)'
    ).bind(c, String(name || c), String(description || ''), user.name || user.fanbook_id).run()
    const row = await env.DB.prepare('SELECT id, code, name, description FROM tournaments WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(row, 201)
  } catch (e) {
    return handleError(e)
  }
}
