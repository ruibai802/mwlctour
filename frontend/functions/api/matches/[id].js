// /api/matches/:id — 比赛详情/修改/删除
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../_lib/util.js'
import { formatMatchDetail, resolveTeamName, makeRoom, MATCH_STATUS } from '../../_lib/match.js'
import { hasPerm } from '../../_lib/rbac.js'

// 解析比分：兼容 3:2 / 3-2 / 3：2（半角/全角冒号、短横）
function parseScore(score) {
  const m = String(score || '').match(/^\s*(\d+)\s*[:：\-]\s*(\d+)\s*$/)
  if (!m) return null
  return { a: parseInt(m[1], 10), b: parseInt(m[2], 10) }
}

// 解析对阵名：如 "左卫门 VS 王" / "A队 vs B队" → [A队名, B队名]
function parseMatchup(matchup) {
  const m = String(matchup || '').match(/^\s*(.+?)\s*(?:VS|vs|对)\s*(.+?)\s*$/)
  if (!m) return null
  const a = m[1].trim()
  const b = m[2].trim()
  if (!a || !b) return null
  return [a, b]
}

// 是否可管理/录分比赛
async function canManageMatch(user, env) {
  if (isAdmin(user)) return true
  try {
    return await hasPerm(env, user, 'result:submit')
  } catch (e) {
    return false
  }
}

async function cleanMatch(env, body, existing) {
  const base = existing || {}
  const m = {}
  for (const f of ['matchup', 'room', 'start_time', 'end_time', 'map', 'score', 'winner', 'status', 'remark', 'tournament_name']) {
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

  // 录分自动处理：填了比分 → 自动判定胜者、自动已完成、自动标记弃权
  if (m.score) {
    const parts = parseScore(m.score)
    if (parts) {
      // 胜者判定：优先用对阵名（matchup）里设定的两个队伍名，其次用队伍字段名
      const mup = parseMatchup(m.matchup)
      const aName = mup ? mup[0] : m.team_a_name
      const bName = mup ? mup[1] : m.team_b_name
      m.winner = parts.a > parts.b ? aName : parts.b > parts.a ? bName : ''
      // 弃权标记：1:0 或 0:1（一方 0 分）→ 备注自动填「弃权组」
      const isWalkover = (parts.a === 1 && parts.b === 0) || (parts.a === 0 && parts.b === 1)
      if (isWalkover && !m.remark.includes('弃权组')) {
        m.remark = m.remark ? `${m.remark}\n弃权组` : '弃权组'
      }
      // 状态自动已完成（填比分即表示比赛结束）
      m.status = 'completed'
    }
  }
  return m
}

export async function onRequestGet(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const row = await env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(params.id).first()
    if (!row) return notFound('比赛不存在')
    return json(await formatMatchDetail(env, row))
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const row = await env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(params.id).first()
    if (!row) return notFound('比赛不存在')
    // 接取权限：日程已被裁判/录像接取时，仅接取者或管理员可更新
    const claimedRef = String(row.claimed_referee_id || '')
    const claimedRec = String(row.claimed_recorder_id || '')
    const isClaimedUser = claimedRef === String(user.id) || claimedRec === String(user.id)
    if (claimedRef || claimedRec) {
      if (!isAdmin(user) && !isClaimedUser) {
        return forbidden('该日程已由接取的裁判/录像负责，仅接取者或管理员可更新')
      }
    } else if (!(await canManageMatch(user, env))) {
      return forbidden('无权限执行此操作')
    }
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const m = await cleanMatch(env, body, row)
    if (m.team_a_id && m.team_b_id && m.team_a_id === m.team_b_id) {
      return badRequest('对阵双方不能是同一支队伍')
    }
    await env.DB.prepare(`
      UPDATE matches SET group_id=?, round=?, seq=?, matchup=?, room=?, start_time=?, end_time=?,
        team_a_id=?, team_b_id=?, team_a_name=?, team_b_name=?, map=?, score=?, winner=?, status=?, remark=?,
        tournament_name=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).bind(
      m.group_id, m.round, m.seq, m.matchup, m.room, m.start_time, m.end_time,
      m.team_a_id, m.team_b_id, m.team_a_name, m.team_b_name, m.map, m.score, m.winner, m.status, m.remark,
      m.tournament_name || '',
      row.id
    ).run()
    const updated = await env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(row.id).first()
    return json(await formatMatchDetail(env, updated))
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
    const info = await env.DB.prepare('DELETE FROM matches WHERE id = ?').bind(params.id).run()
    if (!info.meta.changes) return notFound('比赛不存在')
    return json({ message: '比赛已删除' })
  } catch (e) {
    return handleError(e)
  }
}