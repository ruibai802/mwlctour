import { defineStore } from 'pinia'
import { login as apiLogin, getMe } from '../api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('mwlc_token') || '',
    user: JSON.parse(localStorage.getItem('mwlc_user') || 'null')
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    isAdmin: (s) => s.user && (s.user.role === 'admin' || s.user.role === 'superadmin'),
    isSuperAdmin: (s) => s.user && s.user.role === 'superadmin',
    canEditRules: (s) => s.user && (s.user.role === 'rules' || s.user.role === 'admin' || s.user.role === 'superadmin')
  },
  actions: {
    setSession(token, user) {
      this.token = token
      this.user = user
      localStorage.setItem('mwlc_token', token)
      localStorage.setItem('mwlc_user', JSON.stringify(user))
    },
    async login(fanbookId, password) {
      const data = await apiLogin(fanbookId, password)
      this.setSession(data.token, data.user)
      return data.user
    },
    async refresh() {
      if (!this.token) return null
      try {
        const { user } = await getMe()
        this.user = user
        localStorage.setItem('mwlc_user', JSON.stringify(user))
        return user
      } catch (e) {
        this.logout()
        return null
      }
    },
    updateProfile(user) {
      if (!user) return
      this.user = user
      localStorage.setItem('mwlc_user', JSON.stringify(user))
    },
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('mwlc_token')
      localStorage.removeItem('mwlc_user')
    }
  }
})
