import { defineStore } from 'pinia'
import { getTournaments, getTournament } from '../api'

export const useTournamentStore = defineStore('tournament', {
  state: () => ({
    list: [],
    currentId: parseInt(localStorage.getItem('mwlc_tournament_id') || '1', 10) || 1,
    current: null,
    loaded: false
  }),
  getters: {
    currentName: (s) => s.current?.name || (s.list.find((t) => t.id === s.currentId)?.name) || '未选择赛事'
  },
  actions: {
    async fetchList() {
      this.list = await getTournaments()
      if (!this.list.some((t) => t.id === this.currentId) && this.list.length) {
        await this.setCurrent(this.list[0].id)
      }
      return this.list
    },
    async setCurrent(id) {
      const n = parseInt(id, 10) || 1
      if (!Number.isInteger(n) || n <= 0) return
      this.currentId = n
      localStorage.setItem('mwlc_tournament_id', String(n))
      await this.fetchCurrent()
    },
    async fetchCurrent() {
      const t = this.list.find((x) => x.id === this.currentId) || { code: 'default' }
      this.current = await getTournament(t.code)
      return this.current
    },
    async load(forceCurrent) {
      await this.fetchList()
      if (forceCurrent || !this.current) {
        await this.fetchCurrent()
      }
      this.loaded = true
    }
  }
})