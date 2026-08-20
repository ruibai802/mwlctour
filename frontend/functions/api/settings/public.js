// GET /api/settings/public — 公开赛事设置（规则/背景/地图）
import { json } from '../../_lib/auth.js'
import { resolveTournamentId, getTournamentById, handleError } from '../../_lib/util.js'

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
  try {
    const t = await getTournamentById(env, await resolveTournamentId(request, env))
    return json(format(t))
  } catch (e) {
    return handleError(e)
  }
}
