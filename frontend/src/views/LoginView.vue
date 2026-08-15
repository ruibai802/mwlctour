<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const fanbookId = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  if (!fanbookId.value || !password.value) {
    error.value = '请输入账号和密码'
    return
  }
  loading.value = true
  try {
    await auth.login(fanbookId.value, password.value)
    const redirect = route.query.redirect
    router.push(typeof redirect === 'string' ? redirect : '/dashboard')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="card login-card">
      <h2>登录</h2>
      <p class="hint">裁判/录像使用 fanbookID（数字）登录，默认密码 MWLC123456</p>
      <div class="form-group">
        <label>fanbookID</label>
        <input v-model="fanbookId" class="form-control" type="text" placeholder="请输入 fanbookID" @keyup.enter="handleLogin" />
      </div>
      <div class="form-group">
        <label>密码</label>
        <input v-model="password" class="form-control" type="password" placeholder="请输入密码" @keyup.enter="handleLogin" />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn btn-primary login-btn" :disabled="loading" @click="handleLogin">
        {{ loading ? '登录中...' : '登录' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  padding-top: 70px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 32px;
  background: var(--bg-input);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(56, 189, 248, 0.25);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4), 0 0 40px rgba(56, 189, 248, 0.08);
}

.login-card h2 {
  margin-bottom: 6px;
  background: linear-gradient(90deg, #e0f2fe, var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 24px;
}

.hint {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 22px;
}

.error {
  color: var(--red);
  font-size: 13px;
  margin-bottom: 12px;
}

.login-btn {
  width: 100%;
}
</style>
