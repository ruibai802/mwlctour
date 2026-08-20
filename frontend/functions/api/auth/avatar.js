// POST /api/auth/avatar — 上传头像（R2 存储）
import { currentUser, publicUser, json, unauthorized, badRequest } from '../../_lib/auth.js'
import { saveFile, keyFromUrl, removeFile } from '../../_lib/upload.js'

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  let form
  try { form = await request.formData() } catch (e) { return badRequest('上传失败') }
  const file = form.get('avatar')
  if (!file) return badRequest('未选择头像图片')
  if (!file.type || !file.type.startsWith('image/')) return badRequest('头像仅支持图片文件')
  if (file.size > 5 * 1024 * 1024) return badRequest('头像不能超过 5MB')
  const { url } = await saveFile(env, 'data', file)
  const oldUrl = user.avatar || ''
  await env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(url, user.id).run()
  if (oldUrl && oldUrl !== url) await removeFile(env, keyFromUrl(oldUrl))
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first()
  return json({ user: publicUser(row), avatar: url })
}
