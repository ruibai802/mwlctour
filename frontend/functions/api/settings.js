// /api/settings — 赛事设置（规则内容/背景/地图/报名链接/多个赛事名）
import { currentUser, canEditRules, json, unauthorized, forbidden } from '../_lib/auth.js'
import { resolveTournamentId, getTournamentById, handleError } from '../_lib/util.js'

// 读取赛事设置中的「多个赛事名」列表（settings 表 key = tournament_names）
async function getTournamentNames(env) {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'tournament_names'").first()
  let arr = []
  try { arr = JSON.parse(r ? r.value : '[]') } catch (e) { arr = [] }
  return Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : []
}

function format(t, tournamentNames = []) {
  let maps = []
  try { maps = JSON.parse(t.maps || '[]') } catch (e) { maps = [] }
  return {
    tournament_name: t.name,
    tournament_code: t.code,
    tournament_id: t.id,
    rules_content: t.rules_content,
    rules_background: t.rules_background,
    content_background: t.content_background || '',
    registration_url: t.registration_url,
    maps,
    tournament_names: tournamentNames
  }
}

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  const t = await getTournamentById(env, await resolveTournamentId(request, env))
  const names = await getTournamentNames(env)
  return json(format(t, names))
}

export async function onRequestPut(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!canEditRules(user)) return forbidden('仅规则管理/管理员可执行此操作')
  try {
    const t = await getTournamentById(env, await resolveTournamentId(request, env))
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const { tournament_name, rules_content, rules_background, registration_url, maps, tournament_names } = body || {}
    const newMaps = (maps !== undefined && Array.isArray(maps))
      ? JSON.stringify(maps.map((m) => String(m)))
      : t.maps
    await env.DB.prepare(`
      UPDATE tournaments SET
        name = ?, rules_content = ?, rules_background = ?, registration_url = ?, maps = ?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).bind(
      tournament_name !== undefined ? String(tournament_name) : t.name,
      rules_content !== undefined ? String(rules_content) : t.rules_content,
      rules_background !== undefined ? String(rules_background) : t.rules_background,
      registration_url !== undefined ? String(registration_url) : t.registration_url,
      newMaps,
      t.id
    ).run()
    // 保存多个赛事名列表（settings 表）
    if (Array.isArray(tournament_names)) {
      const clean = [...new Set(tournament_names.map((x) => String(x).trim()).filter(Boolean))]
      await env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES ('tournament_names', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).bind(JSON.stringify(clean)).run()
    }
    const updated = await getTournamentById(env, t.id)
    const names = await getTournamentNames(env)
    return json(format(updated, names))
  } catch (e) {
    return handleError(e)
  }
}
