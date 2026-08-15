// /api/auth/* — 登录、修改密码、当前用户、头像（替代原 authRoutes.js）
import bcrypt from 'bcryptjs'
import {
  signToken, publicUser, currentUser, json, unauthorized, badRequest
} from '../_lib/auth.js'
import { saveFile, keyFromUrl, removeFile } from '../_lib/upload.js'

export async function onRequestPost(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname

  // POST /api/auth/login
  if (path === '/api/auth/login' || path.endsWith('/login')) {
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

  // POST /api/auth/change-password
  if (path.endsWith('/change-password')) {
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

  // POST /api/auth/avatar
  if (path.endsWith('/avatar')) {
    const user = await currentUser(request, env)
    if (!user) return unauthorized()
    let form
    try { form = await request.formData() } catch (e) { return badRequest('上传失败') }
    const file = form.get('avatar')
    if (!file) return badRequest('未选择头像图片')
    if (!file.type || !file.type.startsWith('image/')) return badRequest('头像仅支持图片文件')
    if (file.size > 5 * 1024 * 1024) return badRequest('头像不能超过 5MB')
    const { url } = await saveFile(env, 'data', file)
    // 删除旧头像文件
    const oldUrl = user.avatar || ''
    await env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(url, user.id).run()
    if (oldUrl && oldUrl !== url) await removeFile(env, keyFromUrl(oldUrl))
    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first()
    return json({ user: publicUser(row), avatar: url })
  }

  return json({ error: '接口不存在' }, 404)
}

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first()
  return json({ user: publicUser(row) })
}

export async function onRequestPut(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  let body
  try { body = await request.json() } catch (e) { body = {} }
  const { name } = body || {}
  if (name === undefined || String(name).trim() === '') return badRequest('姓名不能为空')
  await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(String(name).trim().slice(0, 40), user.id).run()
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first()
  return json({ user: publicUser(row) })
}
