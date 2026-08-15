// /api/schedules/:id — 日程详情/修改/删除
import { currentUser, isAdmin, json, unauthorized, forbidden, notFound } from '../../_lib/auth.js'
import { resolveTournamentId, nowStr, serializeLineup, buildRoom, formatSchedule, handleError } from '../../_lib/util.js'

const FIELDS = [
  'group_name', 'round', 'seq', 'matchup', 'room', 'time',
  'team_a_name', 't1_a_name', 't1_a_fb', 't1_a_id', 't2_a_name', 't2_a_id', 'sub_a_name', 'sub_a_id',
  'team_b_name', 't1_b_name', 't1_b_fb', 't1_b_id', 't2_b_name', 't2_b_id', 'sub_b_name', 'sub_b_id',
  'map', 'remark'
]

function extractScheduleBody(body) {
  const data = {}
  for (const f of FIELDS) {
    data[f] = body[f] !== undefined ? String(body[f]) : ''
  }
  data.round = parseInt(data.round, 10) || 1
  data.seq = parseInt(data.seq, 10) || 1
  data.team_a_lineup = body.team_a_lineup !== undefined ? body.team_a_lineup : []
  data.team_b_lineup = body.team_b_lineup !== undefined ? body.team_b_lineup : []
  if (!data.room) data.room = buildRoom(data.round, data.seq)
  const deriveCore = (side, lineup) => {
    if (!Array.isArray(lineup) || !lineup.length) return
    if (data[`t1_${side}_name`]) return
    const at = (i) => (i < lineup.length ? lineup[i] : null)
    const p1 = at(0); const p2 = at(1); const p3 = at(2)
    data[`t1_${side}_name`] = p1 ? String(p1.name || '') : ''
    data[`t1_${side}_fb`] = p1 ? String(p1.fanbook || '') : ''
    data[`t1_${side}_id`] = p1 ? String(p1.game_id || '') : ''
    data[`t2_${side}_name`] = p2 ? String(p2.name || '') : ''
    data[`t2_${side}_id`] = p2 ? String(p2.game_id || '') : ''
    data[`sub_${side}_name`] = p3 ? String(p3.name || '') : ''
    data[`sub_${side}_id`] = p3 ? String(p3.game_id || '') : ''
  }
  deriveCore('a', data.team_a_lineup)
  deriveCore('b', data.team_b_lineup)
  return data
}

export async function onRequestGet(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const row = await env.DB.prepare('SELECT * FROM schedules WHERE id = ? AND tournament_id = ?')
      .bind(params.id, await resolveTournamentId(request, env)).first()
    if (!row) return notFound('日程不存在')
    return json(await formatSchedule(env, row))
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
    const existing = await env.DB.prepare('SELECT * FROM schedules WHERE id = ? AND tournament_id = ?').bind(params.id, tid).first()
    if (!existing) return notFound('日程不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const data = extractScheduleBody(body)
    const tags = `${existing.tags || ''}\n修改于${nowStr()},来自于${user.name || user.fanbook_id}`.trim()
    await env.DB.prepare(`
      UPDATE schedules SET
        group_name=?, round=?, seq=?, matchup=?, room=?, time=?,
        team_a_name=?, t1_a_name=?, t1_a_fb=?, t1_a_id=?, t2_a_name=?, t2_a_id=?, sub_a_name=?, sub_a_id=?,
        team_b_name=?, t1_b_name=?, t1_b_fb=?, t1_b_id=?, t2_b_name=?, t2_b_id=?, sub_b_name=?, sub_b_id=?,
        map=?, remark=?, tags=?, updated_at=datetime('now','localtime'),
        team_a_lineup=?, team_b_lineup=?
      WHERE id=? AND tournament_id=?
    `).bind(
      data.group_name, data.round, data.seq, data.matchup, data.room, data.time,
      data.team_a_name, data.t1_a_name, data.t1_a_fb, data.t1_a_id, data.t2_a_name, data.t2_a_id, data.sub_a_name, data.sub_a_id,
      data.team_b_name, data.t1_b_name, data.t1_b_fb, data.t1_b_id, data.t2_b_name, data.t2_b_id, data.sub_b_name, data.sub_b_id,
      data.map, data.remark, tags,
      serializeLineup(data.team_a_lineup), serializeLineup(data.team_b_lineup),
      params.id, tid
    ).run()
    const row = await env.DB.prepare('SELECT * FROM schedules WHERE id = ? AND tournament_id = ?').bind(params.id, tid).first()
    return json(await formatSchedule(env, row))
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
    const info = await env.DB.prepare('DELETE FROM schedules WHERE id = ? AND tournament_id = ?')
      .bind(params.id, await resolveTournamentId(request, env)).run()
    if (info.meta.changes === 0) return notFound('日程不存在')
    return json({ message: '日程已删除' })
  } catch (e) {
    return handleError(e)
  }
}
