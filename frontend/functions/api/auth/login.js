// POST /api/auth/login — 登录
import bcrypt from 'bcryptjs'
import { signToken, publicUser, json, unauthorized, badRequest } from '../../_lib/auth.js'

export async function onRequestPost(context) {
  const { request, env } = context
  let body
  try { body = await request.json() } catch (e) { body = {} }
  const { fanbook_id, password } = body || {}
  if (!fanbook_id || !password) return badRequest('请输入账号和密码')
  const user = await env.DB.prepare('SELECT * FROM users WHERE fanbook_id = ?').bind(String(fanbook_id).trim()).first()
  if (!user) return unauthorized('账号不存在')
  const ok = await bcrypt.compare(String(password), user.password_hash)
  if (!ok) return unauthorized('密码错误')
  const token = await signToken(user)
  return json({ token, user: publicUser(user) })
}
