// POST /api/players/batch-delete — 批量删除选手
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest } from '../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../_lib/util.js'

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const ids = Array.isArray(body && body.ids) ? body.ids : []
    if (!ids.length) return badRequest('请选择要删除的选手')
    const cleanIds = [...new Set(ids.map(Number))].filter((n) => Number.isInteger(n) && n > 0)
    if (!cleanIds.length) return badRequest('选手ID不合法')
    const tid = await resolveTournamentId(request, env)
    let deleted = 0
    const del = env.DB.prepare('DELETE FROM players WHERE id = ? AND tournament_id = ?')
    for (const id of cleanIds) {
      const info = await del.bind(id, tid).run()
      deleted += info.meta.changes
    }
    return json({ message: `已删除 ${deleted} 名选手`, deleted })
  } catch (e) {
    return handleError(e)
  }
}
