// /api/permissions — 全部权限定义（admin）
import { currentUser, isAdmin, json, unauthorized, forbidden } from '../_lib/auth.js'
import { handleError } from '../_lib/util.js'

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const rows = await env.DB.prepare('SELECT * FROM permissions ORDER BY id').all()
    return json((rows.results || rows).map((r) => ({ id: r.id, code: r.code, name: r.name, description: r.description })))
  } catch (e) {
    return handleError(e)
  }
}