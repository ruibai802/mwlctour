// Pages Functions 共享工具（替代原 backend/src/tournament.js 与 scheduleRoutes 中的工具函数）
import { json } from './auth.js'

// 解析 X-Tournament-Id 请求头，未提供时回退到第一个赛事
export async function resolveTournamentId(request, env) {
  const raw = request.headers.get('X-Tournament-Id')
  const n = parseInt(raw, 10)
  if (Number.isInteger(n) && n > 0) return n
  const first = await env.DB.prepare('SELECT id FROM tournaments ORDER BY id LIMIT 1').first()
  return first ? first.id : 1
}

export async function getTournamentById(env, id) {
  const t = await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(id).first()
  if (t) return t
  const first = await env.DB.prepare('SELECT * FROM tournaments ORDER BY id LIMIT 1').first()
  if (first) return first
  return {
    id: 1,
    code: 'default',
    name: 'MWLC赛事',
    rules_content: '',
    rules_background: '',
    content_background: '',
    maps: '[]'
  }
}

export function nowStr() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function parseJson(raw, fallback) {
  try {
    const v = JSON.parse(raw || 'null')
    return v === null ? fallback : v
  } catch (e) {
    return fallback
  }
}

export function parseLineup(raw) {
  const arr = parseJson(raw, [])
  if (!Array.isArray(arr)) return []
  return arr.map((p) => ({
    slot: String((p && p.slot) || '').toUpperCase(),
    name: String((p && p.name) || ''),
    fanbook: String((p && p.fanbook) || ''),
    game_id: String((p && p.game_id) || '')
  }))
}

export function serializeLineup(list) {
  if (!Array.isArray(list)) return '[]'
  return JSON.stringify(
    list.map((p) => ({
      slot: String((p && p.slot) || '').toUpperCase(),
      name: String((p && p.name) || ''),
      fanbook: String((p && p.fanbook) || ''),
      game_id: String((p && p.game_id) || '')
    }))
  )
}

export async function getResultBySchedule(env, scheduleId) {
  return (await env.DB.prepare('SELECT * FROM results WHERE schedule_id = ?').bind(scheduleId).first()) || null
}

// 格式化日程：解析 lineup 与 result 中的 JSON 数组字段（原 formatSchedule）
export async function formatSchedule(env, row) {
  const result = await getResultBySchedule(env, row.id)
  let screenshots = []
  let gameLinks = []
  if (result) {
    screenshots = parseJson(result.screenshots, [])
    if (!Array.isArray(screenshots)) screenshots = []
    gameLinks = parseJson(result.game_links, [])
    if (!Array.isArray(gameLinks)) gameLinks = []
  }
  return {
    ...row,
    team_a_lineup: parseLineup(row.team_a_lineup),
    team_b_lineup: parseLineup(row.team_b_lineup),
    status: result ? 'completed' : 'pending',
    result: result ? { ...result, screenshots, game_links: gameLinks } : null
  }
}

export function buildRoom(round, seq) {
  return `R${round}${seq}`
}

export async function handleError(e) {
  console.error(e)
  return json({ error: '服务器内部错误' }, 500)
}
