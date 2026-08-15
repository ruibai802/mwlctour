import { defineStore } from 'pinia'

const STORAGE_KEY = 'mwlc-theme-mode'

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: 'system'
  }),
  getters: {
    resolved(state) {
      if (state.mode === 'dark') return 'dark'
      if (state.mode === 'light') return 'light'
      return systemDark() ? 'dark' : 'light'
    },
    isDark() {
      return this.resolved === 'dark'
    }
  },
  actions: {
    init() {
      const saved = localStorage.getItem(STORAGE_KEY)
      this.mode = saved === 'light' || saved === 'dark' ? saved : 'system'
      this.apply()
      if (typeof window !== 'undefined' && window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        const onChange = () => {
          if (this.mode === 'system') this.apply()
        }
        if (mq.addEventListener) mq.addEventListener('change', onChange)
        else if (mq.addListener) mq.addListener(onChange)
      }
    },
    apply() {
      const theme = this.resolved
      const root = document.documentElement
      if (theme === 'dark') root.setAttribute('data-theme', 'dark')
      else if (theme === 'light') root.setAttribute('data-theme', 'light')
      else root.removeAttribute('data-theme')
      this.syncMeta(theme)
    },
    setMode(mode) {
      this.mode = mode
      localStorage.setItem(STORAGE_KEY, mode)
      this.apply()
    },
    syncMeta(theme) {
      const meta = document.querySelector('meta[name="color-scheme"]')
      if (meta) meta.content = theme
    }
  }
})
