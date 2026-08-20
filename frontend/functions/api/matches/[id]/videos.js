// POST /api/matches/:id/videos — 添加视频链接
import { currentUser, json, unauthorized, forbidden, badRequest, notFound } from '../../../_lib/auth.js'
import { hasPerm, getUserPermissions } from '../../../_lib/rbac.js'
import { handleError } from '../../../_lib/util.js'

export async function onRequestPost(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  const perms = await getUserPermissions(env, user)
  if (!['superadmin', 'admin'].includes(user.role) && !perms.includes('video:manage')) {
    return forbidden('无权限管理视频链接')
  }
  try {
    const match = await env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(params.id).first()
    if (!match) return notFound('比赛不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    if (!String(body.url || '').trim()) return badRequest('缺少视频链接')
    const info = await env.DB.prepare(
      'INSERT INTO videos (match_id, game_number, title, url, platform, uploaded_by) VALUES (?,?,?,?,?,?)'
    ).bind(
      match.id,
      parseInt(body.game_number, 10) || 1,
      String(body.title || '').trim(),
      String(body.url).trim(),
      String(body.platform || '').trim(),
      String(user.name || user.fanbook_id)
    ).run()
    const row = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(row, 201)
  } catch (e) {
    return handleError(e)
  }
}