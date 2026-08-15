// /api/schedules/missing-links — 缺视频链接的日程（按组别汇总）
import { currentUser, json, unauthorized } from '../../_lib/auth.js'
import { resolveTournamentId, formatSchedule, handleError } from '../../_lib/util.js'

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const tid = await resolveTournamentId(request, env)
    const rows = await env.DB.prepare(`
      SELECT s.*, r.score, r.winner, r.game_links
      FROM schedules s
      INNER JOIN results r ON r.schedule_id = s.id
      WHERE s.tournament_id = ? AND (r.game_links = '[]' OR r.game_links IS NULL OR r.game_links = '')
      ORDER BY s.group_name, s.round, s.seq
    `).bind(tid).all()
    const list = rows.results || rows
    const byGroup = {}
    for (const r of list) {
      if (!byGroup[r.group_name]) byGroup[r.group_name] = []
      byGroup[r.group_name].push(await formatSchedule(env, r))
    }
    return json({ total: list.length, byGroup })
  } catch (e) {
    return handleError(e)
  }
}
