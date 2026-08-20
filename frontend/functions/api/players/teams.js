// GET /api/players/teams — 按队伍分组
import { currentUser, json, unauthorized } from '../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../_lib/util.js'

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const tid = await resolveTournamentId(request, env)
    const teams = {}
    const rows = await env.DB.prepare('SELECT * FROM players WHERE tournament_id = ? ORDER BY team, id').bind(tid).all()
    for (const r of rows.results || rows) {
      if (!teams[r.team]) teams[r.team] = { team: r.team, players: [] }
      teams[r.team].players.push(r)
    }
    return json(Object.values(teams))
  } catch (e) {
    return handleError(e)
  }
}
