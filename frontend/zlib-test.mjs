// 测试 workerd(nodejs_compat) 是否支持 node:zlib gzipSync
import { gzipSync, gunzipSync } from 'node:zlib'
const text = JSON.stringify({ hello: 'world', cn: '中文', arr: Array.from({ length: 100 }, (_, i) => i) })
const gz = gzipSync(Buffer.from(text, 'utf8'))
console.log('gzipSync 输出:', gz.length, '字节, 前4字节:', gz.slice(0, 4).toString('hex'))
const back = gunzipSync(gz).toString('utf8')
console.log('解压回读一致:', back === text)
