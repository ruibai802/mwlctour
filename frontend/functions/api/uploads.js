// /api/uploads — 上传文件列表/上传（R2 存储）
import { currentUser, isAdmin, ADMIN_ROLES, RULES_ROLES, json, unauthorized, forbidden, badRequest } from '../_lib/auth.js'
import { resolveTournamentId, handleError } from '../_lib/util.js'
import { saveFile } from '../_lib/upload.js'

const ALLOWED_TYPES = ['banner', 'roster', 'map', 'document', 'other', 'editor-image']

function canUpload(user, type) {
  if (ADMIN_ROLES.includes(user.role)) return true
  // 规则管理身份允许上传横幅（用于规则页背景）
  if (RULES_ROLES.includes(user.role) && String(type) === 'banner') return true
  return false
}

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const tid = await resolveTournamentId(request, env)
    let rows
    if (type) {
      rows = await env.DB.prepare('SELECT * FROM uploads WHERE type = ? AND tournament_id = ? ORDER BY id DESC').bind(String(type), tid).all()
    } else {
      rows = await env.DB.prepare('SELECT * FROM uploads WHERE tournament_id = ? ORDER BY id DESC').bind(tid).all()
    }
    return json(rows.results || rows)
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    let form
    try { form = await request.formData() } catch (e) { return badRequest('上传失败') }
    const type = form.get('type')
    if (!canUpload(user, type)) return forbidden('仅管理员可上传数据，规则管理可上传横幅')
    const file = form.get('file')
    if (!file) return badRequest('未选择文件')
    if (file.size > 50 * 1024 * 1024) return badRequest('文件不能超过 50MB')
    const finalType = ALLOWED_TYPES.includes(type) ? type : 'other'
    const { url } = await saveFile(env, 'data', file)
    const info = await env.DB.prepare(
      'INSERT INTO uploads (type, original_name, filename, path, uploaded_by, tournament_id) VALUES (?,?,?,?,?,?)'
    ).bind(
      finalType,
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
