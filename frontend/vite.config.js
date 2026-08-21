import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import obfuscator from 'javascript-obfuscator'

// 代码混淆插件：构建时对每个 JS chunk 深度混淆，防止 F12 直接阅读源码
function obfuscatePlugin() {
  return {
    name: 'obfuscate-js',
    apply: 'build',
    enforce: 'post',
    // 必须在 generateBundle 阶段混淆：
    // renderChunk 阶段动态 import 路径还是 Rollup 占位符（!~{NNN}~），
    // 混淆会把 import("...") 变成 import(解码函数)，导致占位符无法被替换成真实文件名，
    // 浏览器请求到不存在的 chunk（MIME text/html → 路由懒加载失败 → 页面空白）。
    generateBundle(_options, bundle) {
      for (const key of Object.keys(bundle)) {
        const chunk = bundle[key]
        if (!chunk || chunk.type !== 'chunk' || !key.endsWith('.js')) continue
        if (!chunk.code || chunk.code.includes('@vite/')) continue
        // 跳过含 Vite 运行时（modulepreload / __vite__mapDeps / __vitePreload）的入口 chunk：
        // 这些代码负责动态注入异步组件的 CSS，混淆会破坏 modulepreload 的依赖映射，
        // 导致组件样式丢失（只剩全局背景和文字）。
        if (/__vitePreload|__vite__mapDeps|modulepreload/.test(chunk.code)) continue
        try {
          const result = obfuscator.obfuscate(chunk.code, {
            compact: true,
            simplify: true,
            // 字符串全部加密进运行时解码的数组（密钥/URL/文案均不可读）
            stringArray: true,
            stringArrayEncoding: ['base64'],
            stringArrayThreshold: 1,
            rotateStringArray: true,
            // 变量名/函数名全部十六进制乱码
            identifierNamesGenerator: 'hexadecimal',
            // 所有字符串（含数组字面量中的文案）转 unicode 转义，F12 下彻底不可读
            unicodeEscapeSequence: true,
            // 关闭会破坏 Vue 运行时/体积爆炸的选项
            transformObjectKeys: false,
            controlFlowFlattening: false,
            deadCodeInjection: false,
            selfDefending: false,
            splitStrings: false,
            numbersToExpressions: false,
            disableConsoleOutput: false,
            renameGlobals: false
          })
          chunk.code = result.getObfuscatedCode()
          // 清空 map，避免泄露源码
          chunk.map = null
        } catch (e) {
          // 混淆失败不阻断构建（保留原代码）
          this.warn('[obfuscate] 跳过 ' + key + ': ' + e.message)
        }
      }
    }
  }
}

export default defineConfig({
  plugins: [vue(), obfuscatePlugin()],
  build: {
    // 不生成 sourcemap，避免暴露原始源码
    sourcemap: false,
    minify: 'esbuild'
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['.monkeycode-ai.online'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
