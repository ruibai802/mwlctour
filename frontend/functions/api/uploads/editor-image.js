// /api/uploads/editor-image — 规则编辑器内嵌图片上传（规则管理/管理员可用）
import { currentUser, RULES_ROLES, json, unauthorized, forbidden, badRequest } from '../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../_lib/util.js'
import { saveFile } from '../../_lib/upload.js'

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!RULES_ROLES.includes(user.role)) return forbidden('仅规则管理/管理员可上传内嵌图片')
  try {
    let form
    try { form = await request.formData() } catch (e) { return badRequest('上传失败') }
    const file = form.get('file')
    if (!file) return badRequest('未选择图片')
    if (!file.type || !file.type.startsWith('image/')) return badRequest('内嵌图片仅支持图片文件')
    if (file.size > 10 * 1024 * 1024) return badRequest('图片不能超过 10MB')
    const { url } = await saveFile(env, 'data', file)
    const info = await env.DB.prepare(
      'INSERT INTO uploads (type, original_name, filename, path, uploaded_by, tournament_id) VALUES (?,?,?,?,?,?)'
    ).bind(
      'editor-image',
      String(file.name || ''),
      String(url.split('/').pop() || ''),
      url,
      user.name || user.fanbook_id,
      await resolveTournamentId(request, env)
    ).run()
    const row = await env.DB.prepare('SELECT * FROM uploads WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(row, 201)
  } catch (e) {
    return handleError(e)
  }
}
