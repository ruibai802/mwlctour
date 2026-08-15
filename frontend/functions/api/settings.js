// /api/settings — 赛事设置（规则内容/背景/地图/报名链接）
import { currentUser, canEditRules, json, unauthorized, forbidden } from '../_lib/auth.js'
import { resolveTournamentId, getTournamentById, handleError } from '../_lib/util.js'

function format(t) {
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
    maps
  }
}

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)
  if (url.pathname.endsWith('/public')) {
    const t = await getTournamentById(env, await resolveTournamentId(request, env))
    return json(format(t))
  }
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  const t = await getTournamentById(env, await resolveTournamentId(request, env))
  return json(format(t))
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
    const { tournament_name, rules_content, rules_background, registration_url, maps } = body || {}
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
    const updated = await getTournamentById(env, t.id)
    return json(format(updated))
  } catch (e) {
    return handleError(e)
  }
}
