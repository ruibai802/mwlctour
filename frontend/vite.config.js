import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import obfuscator from 'javascript-obfuscator'

// 代码混淆插件：构建时对每个 JS chunk 深度混淆，防止 F12 直接阅读源码
function obfuscatePlugin() {
  return {
    name: 'obfuscate-js',
    apply: 'build',
    enforce: 'post',
    renderChunk(code, chunk) {
      if (chunk.type !== 'chunk') return null
      try {
        const result = obfuscator.obfuscate(code, {
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
        return { code: result.getObfuscatedCode(), map: null }
      } catch (e) {
        // 混淆失败不阻断构建（保留原代码）
        this.warn('[obfuscate] 跳过 ' + chunk.fileName + ': ' + e.message)
        return null
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
