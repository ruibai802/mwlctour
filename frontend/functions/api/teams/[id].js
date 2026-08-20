// /api/teams/:id — 队伍详情（含队员+候选）/修改/删除
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../_lib/util.js'
import { formatTeam } from '../teams.js'

function cleanTeam(body) {
  const t = {}
  t.name = body.name !== undefined ? String(body.name).trim() : ''
  t.short_name = body.short_name !== undefined ? String(body.short_name).trim() : ''
  t.logo = body.logo !== undefined ? String(body.logo).trim() : ''
  t.captain = body.captain !== undefined ? String(body.captain).trim() : ''
  t.color = body.color !== undefined ? String(body.color).trim() : ''
  t.sort = parseInt(body.sort, 10) || 0
  t.status = body.status !== undefined ? String(body.status).trim() : ''
  t.remark = body.remark !== undefined ? String(body.remark).trim() : ''
  return t
}

export async function onRequestGet(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const tid = await resolveTournamentId(request, env)
    const team = await env.DB.prepare('SELECT * FROM teams WHERE id = ? AND tournament_id = ?').bind(params.id, tid).first()
    if (!team) return notFound('队伍不存在')
    const players = await env.DB.prepare(`
      SELECT tp.id AS team_player_id, tp.slot, tp.remark AS tp_remark,
             p.id AS player_id, p.team, p.name, p.fanbook, p.game_id, p.slot AS player_slot
      FROM team_players tp JOIN players p ON p.id = tp.player_id
      WHERE tp.team_id = ? ORDER BY tp.slot, p.id
    `).bind(team.id).all()
    const list = players.results || players
    const added = list.map((p) => p.player_id)
    let candidates
    if (added.length) {
      const ph = added.map(() => '?').join(',')
      candidates = await env.DB.prepare(
        `SELECT id, team, name, fanbook, game_id, slot FROM players WHERE tournament_id = ? AND id NOT IN (${ph}) ORDER BY team, slot, id`
      ).bind(tid, ...added).all()
    } else {
      candidates = await env.DB.prepare(
        'SELECT id, team, name, fanbook, game_id, slot FROM players WHERE tournament_id = ? ORDER BY team, slot, id'
      ).bind(tid).all()
    }
    return json({ team: await formatTeam(env, team), players: list, candidates: candidates.results || candidates })
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const tid = await resolveTournamentId(request, env)
    const row = await env.DB.prepare('SELECT * FROM teams WHERE id = ? AND tournament_id = ?').bind(params.id, tid).first()
    if (!row) return notFound('队伍不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const t = cleanTeam(body)
    if (!t.name) return badRequest('缺少队伍名称')
    if (t.status && !['active', 'inactive'].includes(t.status)) t.status = row.status
    if (!t.status) t.status = row.status
    const dup = await env.DB.prepare('SELECT id FROM teams WHERE tournament_id = ? AND name = ? AND id != ?').bind(tid, t.name, row.id).first()
    if (dup) return badRequest('已存在同名队伍')
    await env.DB.prepare(
      "UPDATE teams SET name=?, short_name=?, logo=?, captain=?, color=?, sort=?, status=?, remark=?, updated_at=datetime('now','localtime') WHERE id=?"
    ).bind(t.name, t.short_name, t.logo, t.captain, t.color, t.sort, t.status, t.remark, row.id).run()
    return json(await formatTeam(env, await env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(row.id).first()))
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const matches = await env.DB.prepare('SELECT COUNT(*) AS c FROM matches WHERE team_a_id = ? OR team_b_id = ?').bind(params.id, params.id).first()
    if (matches && matches.c > 0) return badRequest('该队伍已参与比赛，无法删除，请先修改相关比赛')
    const tid = await resolveTournamentId(request, env)
    const info = await env.DB.prepare('DELETE FROM teams WHERE id = ? AND tournament_id = ?').bind(params.id, tid).run()
    if (!info.meta.changes) return notFound('队伍不存在')
    return json({ message: '队伍已删除' })
  } catch (e) {
    return handleError(e)
  }
}