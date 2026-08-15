// Pages Functions 共享：R2 文件存储辅助（替代原 backend/src/upload.js 的 multer/磁盘方案）
// R2 绑定名：UPLOADS；存储路径：data/ 与 screenshots/（与原 uploads 目录结构一致）

// 生成存储 key：时间戳_随机数_清洗后的文件名（保留扩展名）
export function makeKey(subDir, originalName) {
  const ext = (originalName ? '.' + originalName.split('.').pop() : '').toLowerCase().replace(/[^a-z0-9.]/g, '')
  const base = String(originalName || 'file')
    .replace(/\.[^.]*$/, '')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '_')
    .slice(0, 40)
  return `${subDir}/${Date.now()}_${Math.round(Math.random() * 1e6)}_${base}${ext}`
}

// 把 FormData 中的单个文件存入 R2，返回 { key, url }；url 为同域相对路径（/uploads/...）
export async function saveFile(env, subDir, file) {
  const key = makeKey(subDir, file.name)
  await env.UPLOADS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  })
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
