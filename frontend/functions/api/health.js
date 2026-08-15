// /api/health — 健康检查
import { json } from '../_lib/auth.js'

export async function onRequestGet() {
  return json({ status: 'ok', time: new Date().toISOString() })
}
