// /api/auth/me — 当前用户（GET 查询 / PUT 修改姓名）
import { currentUser, publicUser, json, unauthorized, badRequest } from '../../_lib/auth.js'

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
