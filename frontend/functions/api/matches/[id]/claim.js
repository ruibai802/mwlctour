// /api/matches/:id/claim — 裁判/录像接取或取消接取日程
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../../_lib/auth.js'
import { handleError } from '../../../_lib/util.js'
import { hasPerm } from '../../../_lib/rbac.js'

async function canClaim(user, env) {
  if (isAdmin(user)) return true
  try { return await hasPerm(env, user, 'result:submit') } catch (e) { return false }
}

const ROLE_FIELDS = { referee: 'claimed_referee_id', recorder: 'claimed_recorder_id' }

export async function onRequestPost(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!(await canClaim(user, env))) return forbidden('仅裁判/录像或管理员可接取日程')
  try {
    const row = await env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(params.id).first()
    if (!row) return notFound('比赛不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const action = String((body && body.action) || 'claim')
    const role = String((body && body.role) || '')
    const field = ROLE_FIELDS[role]
    if (!field) return badRequest('角色不合法（referee/recorder）')

    if (action === 'unclaim') {
      if (!isAdmin(user) && String(row[field]) !== String(user.id)) {
        return forbidden('只能取消自己的接取')
      }
      await env.DB.prepare(`UPDATE matches SET ${field} = '', updated_at = datetime('now','localtime') WHERE id = ?`).bind(params.id).run()
      return json({ message: '已取消接取' })
    }

    if (action !== 'claim') return badRequest('操作不合法')
    if (row[field]) {
      if (String(row[field]) === String(user.id)) return badRequest('你已接取该日程的此角色')
      return badRequest('该日程的此角色已被其他成员接取')
    }
    await env.DB.prepare(`UPDATE matches SET ${field} = ?, updated_at = datetime('now','localtime') WHERE id = ?`).bind(String(user.id), params.id).run()
    return json({ message: '接取成功' })
  } catch (e) {
    return handleError(e)
  }
}
