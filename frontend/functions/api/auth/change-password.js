// POST /api/auth/change-password — 修改密码
import bcrypt from 'bcryptjs'
import { currentUser, json, unauthorized, badRequest } from '../../_lib/auth.js'

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  let body
  try { body = await request.json() } catch (e) { body = {} }
  const { old_password, new_password } = body || {}
  if (!old_password || !new_password) return badRequest('请填写原密码和新密码')
  if (String(new_password).length < 6) return badRequest('新密码至少 6 位')
  const ok = await bcrypt.compare(String(old_password), user.password_hash)
  if (!ok) return badRequest('原密码错误')
  const hash = await bcrypt.hash(String(new_password), 10)
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, user.id).run()
  return json({ message: '密码修改成功' })
}
