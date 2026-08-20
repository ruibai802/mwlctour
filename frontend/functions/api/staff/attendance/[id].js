// DELETE /api/staff/attendance/:id — 删除考勤记录
import { currentUser, isAdmin, json, unauthorized, forbidden, notFound } from '../../../_lib/auth.js'
import { handleError } from '../../../_lib/util.js'

export async function onRequestDelete(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const info = await env.DB.prepare('DELETE FROM staff_attendance WHERE id = ?').bind(params.id).run()
    if (!info.meta.changes) return notFound('考勤记录不存在')
    return json({ message: '考勤记录已删除' })
  } catch (e) {
    return handleError(e)
  }
}