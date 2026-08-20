// PUT/DELETE /api/videos/:id — 修改/删除视频链接
import { currentUser, json, unauthorized, forbidden, badRequest, notFound } from '../../_lib/auth.js'
import { hasPerm } from '../../_lib/rbac.js'
import { handleError } from '../../_lib/util.js'

async function canManage(env, user) {
  return ['superadmin', 'admin'].includes(user.role) || await hasPerm(env, user, 'video:manage')
}

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!await canManage(env, user)) return forbidden('无权限管理视频链接')
  try {
    const row = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(params.id).first()
    if (!row) return notFound('视频记录不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    if (body.url !== undefined && !String(body.url).trim()) return badRequest('视频链接不能为空')
    await env.DB.prepare('UPDATE videos SET game_number=?, title=?, url=?, platform=? WHERE id=?').bind(
      body.game_number !== undefined ? parseInt(body.game_number, 10) || 1 : row.game_number,
      body.title !== undefined ? String(body.title).trim() : row.title,
      body.url !== undefined ? String(body.url).trim() : row.url,
      body.platform !== undefined ? String(body.platform).trim() : row.platform,
      row.id
    ).run()
    return json(await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(row.id).first())
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!await canManage(env, user)) return forbidden('无权限管理视频链接')
  try {
    const info = await env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(params.id).run()
    if (!info.meta.changes) return notFound('视频记录不存在')
    return json({ message: '视频链接已删除' })
  } catch (e) {
    return handleError(e)
  }
}