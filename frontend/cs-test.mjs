// 验证 CompressionStream 在本地 Node 环境（wrangler 的 workerd 模拟）的输出
import { gunzipSync } from 'zlib'

const text = JSON.stringify({ hello: 'world', arr: [1, 2, 3], cn: '中文测试' })
const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
const buf = await new Response(stream).arrayBuffer()
const bytes = new Uint8Array(buf)
console.log('CompressionStream 输出大小:', bytes.length)
console.log('前4字节 (应为 1f8b):', Buffer.from(bytes.slice(0, 4)).toString('hex'))
try {
  const d = gunzipSync(bytes)
  console.log('解压成功:', d.toString('utf8'))
} catch (e) {
  console.log('解压失败:', e.message)
}
