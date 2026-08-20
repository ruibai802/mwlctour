// Pages Functions 共享：R2 文件存储辅助（替代原 backend/src/upload.js 的 multer/磁盘方案）
// R2 绑定名：UPLOADS；存储路径：data/ 与 screenshots/
// 文件以内容 MD5 命名（内容寻址）：相同文件只存储一份，重复上传自动去重（秒传），减小存储
import md5 from 'md5'

// 把 FormData 中的单个文件存入 R2，返回 { key, url }；url 为同域相对路径（/uploads/...）
// 相同内容的文件（MD5 相同）不会重复上传，直接复用已有文件
export async function saveFile(env, subDir, file) {
  const buf = await file.arrayBuffer()
  const hash = md5(Buffer.from(buf))
  const ext = (file.name ? '.' + file.name.split('.').pop() : '').toLowerCase().replace(/[^a-z0-9.]/g, '')
  const key = `${subDir}/${hash}${ext}`
  const exists = await env.UPLOADS.head(key)
  if (!exists) {
    await env.UPLOADS.put(key, buf, {
      httpMetadata: { contentType: file.type || 'application/octet-stream' }
    })
  }
  return { key, url: `/uploads/${key}` }
}

// 从 R2 删除文件（key 形如 data/xxx.png）
export async function removeFile(env, key) {
  try {
    await env.UPLOADS.delete(key)
  } catch (e) {
    // 忽略删除失败
  }
}

// 由 /uploads/xxx 相对路径推导 R2 key
export function keyFromUrl(url) {
  const s = String(url || '')
  return s.replace(/^\/uploads\//, '')
}

// 批量删除一组 URL 对应的 R2 文件
export async function removeFilesByUrls(env, urls) {
  for (const url of urls || []) {
    const key = keyFromUrl(url)
    if (key) await removeFile(env, key)
  }
}
