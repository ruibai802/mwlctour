// /api/teams — 队伍列表/新增
import { currentUser, isAdmin, json, jsonGz, unauthorized, forbidden, badRequest } from '../_lib/auth.js'
import { resolveTournamentId, handleError } from '../_lib/util.js'

// 队伍列表格式化：批量一次查出所有队伍的队员数与队员，避免 N+1 循环查询
export async function formatTeams(env, rows, withPlayers = false) {
  const list = rows.results || rows
  if (!list.length) return []
  // 1) 一次查询所有队伍的队员数（GROUP BY）
  const countRows = await env.DB.prepare(`
    SELECT tp.team_id, COUNT(*) AS c FROM team_players tp
    WHERE tp.team_id IN (SELECT id FROM teams WHERE tournament_id = ?)
    GROUP BY tp.team_id
  `).bind(list[0].tournament_id).all()
  const countMap = new Map((countRows.results || countRows).map((r) => [String(r.team_id), Number(r.c)]))
  // 2) 可选：一次查询所有队伍的队员名单（JOIN）
  let playersMap = new Map()
  if (withPlayers) {
    const pRows = await env.DB.prepare(`
      SELECT tp.team_id, tp.id AS team_player_id, tp.slot, tp.remark AS tp_remark,
             p.id AS player_id, p.team, p.name, p.fanbook, p.game_id, p.slot AS player_slot
      FROM team_players tp JOIN players p ON p.id = tp.player_id
      WHERE tp.team_id IN (SELECT id FROM teams WHERE tournament_id = ?)
      ORDER BY tp.team_id, tp.slot, p.id
    `).bind(list[0].tournament_id).all()
    for (const r of (pRows.results || pRows)) {
      const key = String(r.team_id)
      if (!playersMap.has(key)) playersMap.set(key, [])
      playersMap.get(key).push(r)
    }
  }
  return list.map((row) => ({
    ...row,
    player_count: countMap.get(String(row.id)) || 0,
    players: withPlayers ? (playersMap.get(String(row.id)) || []) : undefined
  }))
}

// 单队格式化（详情页用）：一次查出该队队员数与名单
export async function formatTeam(env, row, withPlayers = false) {
  const players = await env.DB.prepare(`
    SELECT tp.id AS team_player_id, tp.slot, tp.remark AS tp_remark,
           p.id AS player_id, p.team, p.name, p.fanbook, p.game_id, p.slot AS player_slot
    FROM team_players tp JOIN players p ON p.id = tp.player_id
    WHERE tp.team_id = ? ORDER BY tp.slot, p.id
  `).bind(row.id).all()
  const pcs = await env.DB.prepare('SELECT COUNT(*) AS c FROM team_players WHERE team_id = ?').bind(row.id).first()
  return { ...row, player_count: pcs ? pcs.c : 0, players: withPlayers ? (players.results || players) : undefined }
}

function cleanTeam(body) {
  const t = {}
  t.name = body.name !== undefined ? String(body.name).trim() : ''
  t.short_name = body.short_name !== undefined ? String(body.short_name).trim() : ''
  t.logo = body.logo !== undefined ? String(body.logo).trim() : ''
  t.captain = body.captain !== undefined ? String(body.captain).trim() : ''
  t.color = body.color !== undefined ? String(body.color).trim() : ''
  t.sort = parseInt(body.sort, 10) || 0
  t.status = body.status !== undefined && ['active', 'inactive'].includes(String(body.status).trim()) ? String(body.status).trim() : 'active'
  t.remark = body.remark !== undefined ? String(body.remark).trim() : ''
  return t
}

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const url = new URL(request.url)
    // 默认不携带完整队员名单（列表页只需队伍名+人数）；需要时用 ?with_players=1
    const withPlayers = url.searchParams.get('with_players') === '1'
    const tid = await resolveTournamentId(request, env)
    const rows = await env.DB.prepare('SELECT * FROM teams WHERE tournament_id = ? ORDER BY sort, id').bind(tid).all()
    const out = await formatTeams(env, rows, withPlayers)
    return jsonGz(out)
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
    const t = cleanTeam(body)
    if (!t.name) return badRequest('缺少队伍名称')
    const tid = await resolveTournamentId(request, env)
    const exists = await env.DB.prepare('SELECT id FROM teams WHERE tournament_id = ? AND name = ?').bind(tid, t.name).first()
    if (exists) return badRequest('已存在同名队伍')
    const info = await env.DB.prepare(
      'INSERT INTO teams (tournament_id, name, short_name, logo, captain, color, sort, status, remark) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(tid, t.name, t.short_name, t.logo, t.captain, t.color, t.sort, t.status, t.remark).run()
    const row = await env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(await formatTeams(env, { results: [row] }, true).then((a) => a[0]), 201)
  } catch (e) {
    return handleError(e)
  }
}