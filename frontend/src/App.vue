<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useTournamentStore } from './stores/tournament'

const auth = useAuthStore()
const tournament = useTournamentStore()
const router = useRouter()
const navOpen = ref(false)
const switchErr = ref('')

// 身份较多时，顶部仅显示权限最高的一个身份，避免横排溢出/按钮错位
const TITLE_RANK = ['开发者', '超级管理员', '主办', '管理', '裁判长', '裁判/录像', '规则管理', '赛事工作人员', '普通用户']

const fullTitle = computed(() => (auth.user?.title || '').trim())
const titleCount = computed(() => fullTitle.value.split(/[,，、]/).filter((s) => s.trim()).length)
const displayTitle = computed(() => {
  const titles = fullTitle.value.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
  if (!titles.length) return ''
  if (titles.length === 1) return titles[0]
  for (const rank of TITLE_RANK) {
    if (titles.includes(rank)) return rank
  }
  return titles[0]
})

async function switchTournament(e) {
  switchErr.value = ''
  try {
    await tournament.setCurrent(Number(e.target.value))
    const t = tournament.list.find((x) => x.id === tournament.currentId)
    if (t) {
      router.push({ name: 'rules', params: { code: t.code } })
    }
  } catch (err) {
    switchErr.value = err.message
  }
}

onMounted(async () => {
  auth.refresh()
  if (auth.isLoggedIn) {
    try {
      await tournament.load()
    } catch (e) {
      switchErr.value = e.message
    }
  }
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="container topbar-inner">
        <router-link to="/" class="brand">
          <img src="/mwlc-logo.png" alt="MWLC赛事" class="brand-logo" />
          <span class="brand-dot"></span>
          MWLC赛事协助系统
        </router-link>
        <button class="nav-toggle" @click="navOpen = !navOpen">☰</button>
        <nav class="topnav" :class="{ open: navOpen }">
          <router-link to="/rules/default">赛事规则</router-link>
          <template v-if="auth.isLoggedIn">
            <router-link to="/dashboard">裁判工作台</router-link>
            <router-link v-if="auth.canEditRules" to="/rules-edit">规则管理</router-link>
            <router-link v-if="auth.isAdmin" to="/admin">管理后台</router-link>
          </template>
        </nav>
        <div class="user-area">
          <template v-if="auth.isLoggedIn">
            <router-link to="/settings" class="user-chip" title="个人设置">
              <img v-if="auth.user?.avatar" :src="auth.user.avatar" alt="头像" class="user-avatar" />
              <span v-else class="user-avatar fallback">{{ (auth.user?.name || auth.user?.fanbook_id || '?').slice(0, 1).toUpperCase() }}</span>
              <span class="user-name" :title="auth.user?.name || auth.user?.fanbook_id">{{ auth.user?.name || auth.user?.fanbook_id }}</span>
              <span
                v-if="displayTitle"
                class="user-title"
                :title="fullTitle"
              >{{ displayTitle }}{{ titleCount > 1 ? ` +${titleCount - 1}` : '' }}</span>
            </router-link>
          </template>
          <router-link v-else to="/login" class="btn btn-sm btn-primary">登录</router-link>
        </div>
      </div>
    </header>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-topbar);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.35);
}

.topbar-inner {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 58px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 17px;
  font-weight: 800;
  white-space: nowrap;
  letter-spacing: 0.5px;
  background: linear-gradient(90deg, #e0f2fe, var(--accent), #c4b5fd);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.brand-logo {
  height: 34px;
  width: 34px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
}

.brand-dot {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--accent-grad);
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.8);
  flex-shrink: 0;
}

.nav-toggle {
  display: none;
  background: none;
  border: none;
  color: var(--text-main);
  font-size: 22px;
}

.topnav {
  display: flex;
  gap: 4px;
  flex: 1;
}

.topnav a {
  padding: 7px 16px;
  border-radius: 10px;
  font-size: 14px;
  color: var(--text-sub);
  transition: all 0.15s;
}

.topnav a:hover {
  color: var(--text-main);
  background: rgba(56, 189, 248, 0.1);
}

.topnav a.router-link-exact-active {
  color: var(--accent);
  background: rgba(56, 189, 248, 0.12);
  box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.3);
}

.user-area {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.tournament-select {
  max-width: 150px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-elev);
  color: var(--text-main);
  font-size: 13px;
  padding: 0 6px;
}

.tournament-select:hover {
  border-color: var(--accent);
}

.theme-switch,
.theme-btn {
  display: none;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 6px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-elev);
  text-decoration: none;
  transition: all 0.15s;
  flex-shrink: 0;
}

.user-chip:hover {
  border-color: var(--accent);
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.25);
}

.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid rgba(56, 189, 248, 0.4);
}

.user-avatar.fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-grad);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.user-title {
  font-size: 12px;
  background: rgba(56, 189, 248, 0.14);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: var(--accent);
  padding: 2px 9px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-area .btn {
  background: rgba(56, 189, 248, 0.1);
  border-color: rgba(56, 189, 248, 0.3);
  color: var(--text-main);
  flex-shrink: 0;
}

.user-area .btn:hover {
  color: var(--accent);
}

.main {
  flex: 1;
  padding: 22px 0 44px;
}

@media (max-width: 760px) {
  .nav-toggle {
    display: block;
  }
  .topnav {
    display: none;
    position: absolute;
    top: 58px;
    left: 0;
    right: 0;
    background: var(--bg-topbar-solid);
    border-bottom: 1px solid var(--border);
    flex-direction: column;
    padding: 10px;
  }
  .topnav.open {
    display: flex;
  }
  .user-title {
    display: none;
  }
}
</style>
