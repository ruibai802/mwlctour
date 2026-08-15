// /api/uploads/public — 公开上传文件列表（横幅等）
import { json, handleError } from '../../_lib/auth.js'
import { resolveTournamentId } from '../../_lib/util.js'

export async function onRequestGet(context) {
  const { request, env } = context
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'banner'
    const rows = await env.DB.prepare('SELECT id, type, original_name, path, created_at FROM uploads WHERE type = ? AND tournament_id = ? ORDER BY id DESC')
      .bind(String(type), await resolveTournamentId(request, env)).all()
    return json(rows.results || rows)
  } catch (e) {
    return handleError(e)
  }
}
