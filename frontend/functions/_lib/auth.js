// Pages Functions 共享：JWT 签发/校验 + 权限判断（替代原 backend/src/auth.js）
// 使用 jose（基于 Web Crypto，Cloudflare Workers 原生兼容）
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = () => {
  // 优先取环境变量，未设置时回退（与旧后端行为一致）
  return new TextEncoder().encode(process.env.JWT_SECRET || 'mwlc-tournament-secret-2026')
}

export const ADMIN_ROLES = ['superadmin', 'admin']
export const SUPER_ADMIN_ROLES = ['superadmin']
export const RULES_ROLES = ['rules', 'admin', 'superadmin']

export async function signToken(user) {
  return new SignJWT({
    id: user.id,
    fanbook_id: user.fanbook_id,
    name: user.name,
    title: user.title,
    role: user.role
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET())
}

export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, JWT_SECRET())
  return payload
}

export function publicUser(user) {
  return {
    id: user.id,
    fanbook_id: user.fanbook_id,
    name: user.name,
    title: user.title,
    role: user.role,
    avatar: user.avatar || ''
  }
}

// 从请求中解析用户（校验 Bearer token，返回用户行或 null）
export async function currentUser(request, env) {
  const header = request.headers.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  try {
    const payload = await verifyToken(token)
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.id).first()
    return user || null
  } catch (e) {
    return null
  }
}

export function isAdmin(user) {
  return user && ADMIN_ROLES.includes(user.role)
}

export function isSuperAdmin(user) {
  return user && SUPER_ADMIN_ROLES.includes(user.role)
}

export function canEditRules(user) {
  return user && RULES_ROLES.includes(user.role)
}

// 401 / 403 响应辅助
export function unauthorized(message = '未登录') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })
}

export function forbidden(message = '无权限执行此操作') {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })
}

export function badRequest(message) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })
}

export function notFound(message = '资源不存在') {
  return new Response(JSON.stringify({ error: message }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })
}
