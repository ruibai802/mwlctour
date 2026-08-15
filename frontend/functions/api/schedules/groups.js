// /api/schedules/groups — 组别列表
import { currentUser, json, unauthorized } from '../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../_lib/util.js'

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const rows = await env.DB.prepare('SELECT DISTINCT group_name FROM schedules WHERE tournament_id = ? ORDER BY group_name')
      .bind(await resolveTournamentId(request, env)).all()
    return json((rows.results || rows).map((r) => r.group_name).filter(Boolean))
  } catch (e) {
    return handleError(e)
  }
}
