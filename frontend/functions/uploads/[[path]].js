// /uploads/* — 从 R2 读取上传文件（横幅/截图/头像/内嵌图片等）
// key 规则：data/xxx 或 screenshots/xxx（与数据库 path 字段的 /uploads/ 前缀对应）
export async function onRequestGet(context) {
  const { request, env, params } = context
  const key = params.path || ''
  if (!key) return new Response('Not Found', { status: 404 })
  const obj = await env.UPLOADS.get(key)
  if (!obj) return new Response('Not Found', { status: 404 })
  const headers = new Headers()
  const contentType = (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream'
  headers.set('Content-Type', contentType)
  headers.set('Cache-Control', 'public, max-age=86400')
  return new Response(obj.body, { headers })
}

export async function onRequestHead(context) {
  const { env, params } = context
  const key = params.path || ''
  if (!key) return new Response('Not Found', { status: 404 })
  const obj = await env.UPLOADS.head(key)
  if (!obj) return new Response('Not Found', { status: 404 })
  const headers = new Headers()
  headers.set('Content-Type', (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream')
  headers.set('Cache-Control', 'public, max-age=86400')
  return new Response(null, { headers })
}
