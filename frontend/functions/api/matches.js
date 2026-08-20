// /api/matches — 比赛列表/创建
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest } from '../_lib/auth.js'
import { resolveTournamentId, handleError } from '../_lib/util.js'
import { formatMatchDetail, resolveTeamName, makeRoom, MATCH_STATUS } from '../_lib/match.js'

async function cleanMatch(env, body, existing) {
  const base = existing || {}
  const m = {}
  for (const f of ['matchup', 'room', 'start_time', 'end_time', 'map', 'score', 'winner', 'status', 'remark']) {
    m[f] = body[f] !== undefined ? String(body[f]).trim() : String((base[f] || '')).trim()
  }
  m.round = body.round !== undefined ? parseInt(body.round, 10) || 1 : (base.round || 1)
  m.seq = body.seq !== undefined ? parseInt(body.seq, 10) || 1 : (base.seq || 1)
  m.group_id = body.group_id !== undefined && Number(body.group_id) > 0 ? Number(body.group_id) : null
  const taId = body.team_a_id !== undefined && Number(body.team_a_id) > 0 ? Number(body.team_a_id) : null
  const tbId = body.team_b_id !== undefined && Number(body.team_b_id) > 0 ? Number(body.team_b_id) : null
  m.team_a_id = taId
  m.team_b_id = tbId
  m.team_a_name = body.team_a_name !== undefined ? String(body.team_a_name).trim() : (taId ? await resolveTeamName(env, taId) : String(base.team_a_name || ''))
  m.team_b_name = body.team_b_name !== undefined ? String(body.team_b_name).trim() : (tbId ? await resolveTeamName(env, tbId) : String(base.team_b_name || ''))
  if (!m.room) m.room = makeRoom(m.round, m.seq)
  if (m.status && !MATCH_STATUS.includes(m.status)) m.status = base.status || 'scheduled'
  return m
}

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const url = new URL(request.url)
    const tid = await resolveTournamentId(request, env)
    const group_id = url.searchParams.get('group_id')
    const status = url.searchParams.get('status')
    const keyword = url.searchParams.get('keyword')
    let sql = 'SELECT * FROM matches WHERE tournament_id = ?'
    const params = [tid]
    if (group_id) { sql += ' AND group_id = ?'; params.push(Number(group_id)) }
    if (status) { sql += ' AND status = ?'; params.push(String(status)) }
    if (keyword) {
      sql += ' AND (matchup LIKE ? OR team_a_name LIKE ? OR team_b_name LIKE ? OR room LIKE ?)'
      const kw = `%${String(keyword).trim()}%`
      params.push(kw, kw, kw, kw)
    }
    sql += ' ORDER BY group_id, round, seq, id'
    const rows = await env.DB.prepare(sql).bind(...params).all()
    return json(rows.results || rows)
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const m = await cleanMatch(env, body, {})
    if (m.team_a_id && m.team_b_id && m.team_a_id === m.team_b_id) {
      return badRequest('对阵双方不能是同一支队伍')
    }
    const tid = await resolveTournamentId(request, env)
    const info = await env.DB.prepare(`
      INSERT INTO matches (
        tournament_id, group_id, round, seq, matchup, room, start_time, end_time,
        team_a_id, team_b_id, team_a_name, team_b_name, map, score, winner, status, remark, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      tid, m.group_id, m.round, m.seq, m.matchup, m.room, m.start_time, m.end_time,
      m.team_a_id, m.team_b_id, m.team_a_name, m.team_b_name, m.map, m.score, m.winner, m.status, m.remark,
      String(user.name || user.fanbook_id)
    ).run()
    const row = await env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(await formatMatchDetail(env, row), 201)
  } catch (e) {
    return handleError(e)
  }
}