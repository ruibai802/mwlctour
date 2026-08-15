// /api/uploads/:id — 删除上传文件（含 R2 文件清理）
import { currentUser, ADMIN_ROLES, RULES_ROLES, json, unauthorized, forbidden, notFound } from '../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../_lib/util.js'
import { keyFromUrl, removeFile } from '../../_lib/upload.js'

export async function onRequestDelete(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const row = await env.DB.prepare('SELECT * FROM uploads WHERE id = ? AND tournament_id = ?')
      .bind(params.id, await resolveTournamentId(request, env)).first()
    if (!row) return notFound('文件不存在')
    const allowed = ADMIN_ROLES.includes(user.role) || (RULES_ROLES.includes(user.role) && (row.type === 'banner' || row.type === 'editor-image'))
    if (!allowed) return forbidden('仅管理员可删除文件，规则管理可删除横幅与内嵌图片')
    await removeFile(env, keyFromUrl(row.path))
    await env.DB.prepare('DELETE FROM uploads WHERE id = ?').bind(params.id).run()
    return json({ message: '文件已删除' })
  } catch (e) {
    return handleError(e)
  }
}
