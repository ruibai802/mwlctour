// /api/schedules — 日程列表与创建（替代原 scheduleRoutes.js 的 GET / 与 POST /）
import { currentUser, isAdmin, json, unauthorized, forbidden } from '../_lib/auth.js'
import { resolveTournamentId, nowStr, serializeLineup, buildRoom, formatSchedule, handleError } from '../_lib/util.js'

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
  // 若未单独提供 t1/t2/sub，则从 P1-P7 名单推导（P1→T1、P2→T2、P3→替补）
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
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const group = url.searchParams.get('group')
    const tid = await resolveTournamentId(request, env)
    let rows
    if (status === 'completed') {
      rows = await env.DB.prepare(`
        SELECT s.* FROM schedules s
        INNER JOIN results r ON r.schedule_id = s.id
        WHERE s.tournament_id = ?
        ORDER BY s.group_name, s.round, s.seq
      `).bind(tid).all()
    } else if (status === 'pending') {
      rows = await env.DB.prepare(`
        SELECT s.* FROM schedules s
        LEFT JOIN results r ON r.schedule_id = s.id
        WHERE r.id IS NULL AND s.tournament_id = ?
        ORDER BY s.group_name, s.round, s.seq
      `).bind(tid).all()
    } else {
      rows = await env.DB.prepare('SELECT * FROM schedules WHERE tournament_id = ? ORDER BY group_name, round, seq').bind(tid).all()
    }
    rows = rows.results || rows
    if (group) rows = rows.filter((r) => r.group_name === String(group))
    const out = []
    for (const r of rows) out.push(await formatSchedule(env, r))
    return json(out)
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
    const data = extractScheduleBody(body)
    const tag = `创建于${nowStr()},来自于${user.name || user.fanbook_id}`
    const info = await env.DB.prepare(`
      INSERT INTO schedules (
        tournament_id, group_name, round, seq, matchup, room, time,
        team_a_name, t1_a_name, t1_a_fb, t1_a_id, t2_a_name, t2_a_id, sub_a_name, sub_a_id,
        team_b_name, t1_b_name, t1_b_fb, t1_b_id, t2_b_name, t2_b_id, sub_b_name, sub_b_id,
        map, remark, tags, created_by, team_a_lineup, team_b_lineup
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      await resolveTournamentId(request, env), data.group_name, data.round, data.seq, data.matchup, data.room, data.time,
      data.team_a_name, data.t1_a_name, data.t1_a_fb, data.t1_a_id, data.t2_a_name, data.t2_a_id, data.sub_a_name, data.sub_a_id,
      data.team_b_name, data.t1_b_name, data.t1_b_fb, data.t1_b_id, data.t2_b_name, data.t2_b_id, data.sub_b_name, data.sub_b_id,
      data.map, data.remark, tag, user.name || user.fanbook_id,
      serializeLineup(data.team_a_lineup), serializeLineup(data.team_b_lineup)
    ).run()
    const row = await env.DB.prepare('SELECT * FROM schedules WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(await formatSchedule(env, row), 201)
  } catch (e) {
    return handleError(e)
  }
}
