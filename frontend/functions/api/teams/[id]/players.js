// POST /api/teams/:id/players — 加入选手到队伍
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../../_lib/util.js'

export async function onRequestPost(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const tid = await resolveTournamentId(request, env)
    const team = await env.DB.prepare('SELECT * FROM teams WHERE id = ? AND tournament_id = ?').bind(params.id, tid).first()
    if (!team) return notFound('队伍不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const pid = Number(body.player_id)
    if (!Number.isInteger(pid) || pid <= 0) return badRequest('请选择选手')
    const player = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(pid).first()
    if (!player) return notFound('选手不存在')
    const exists = await env.DB.prepare('SELECT id FROM team_players WHERE team_id = ? AND player_id = ?').bind(team.id, pid).first()
    if (exists) return badRequest('该选手已在队伍中')
    const info = await env.DB.prepare('INSERT INTO team_players (team_id, player_id, slot, remark) VALUES (?,?,?,?)')
      .bind(team.id, pid, String(body.slot || '').trim(), String(body.remark || '').trim()).run()
    const row = await env.DB.prepare(`
      SELECT tp.id AS team_player_id, tp.slot, tp.remark AS tp_remark,
             p.id AS player_id, p.team, p.name, p.fanbook, p.game_id, p.slot AS player_slot
      FROM team_players tp JOIN players p ON p.id = tp.player_id WHERE tp.id = ?
    `).bind(info.meta.last_row_id).first()
    return json(row, 201)
  } catch (e) {
    return handleError(e)
  }
}