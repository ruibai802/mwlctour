<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'
import { changePassword, updateMe, uploadAvatar } from '../api'

const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()

const name = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const savingName = ref(false)
const savingPwd = ref(false)
const uploading = ref(false)
const nameMsg = ref('')
const nameErr = ref('')
const pwdMsg = ref('')
const pwdErr = ref('')
const avatarMsg = ref('')

const avatarUrl = computed(() => auth.user?.avatar || '')
const initial = computed(() => (auth.user?.name || auth.user?.fanbook_id || '?').slice(0, 1).toUpperCase())

const themeOptions = [
  { value: 'system', label: '跟随系统', desc: '自动随系统深浅色', icon: '◐' },
  { value: 'light', label: '浅色', desc: '始终使用浅色主题', icon: '☀' },
  { value: 'dark', label: '深色', desc: '始终使用深色主题', icon: '◉' }
]

function onAvatarChange(e) {
  const file = e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    avatarMsg.value = '仅支持图片文件'
    return
  }
  uploading.value = true
  avatarMsg.value = ''
  const fd = new FormData()
  fd.append('avatar', file)
  uploadAvatar(fd)
    .then((res) => {
      auth.updateProfile(res.user)
      avatarMsg.value = '头像已更新'
      setTimeout(() => (avatarMsg.value = ''), 2000)
    })
    .catch((err) => {
      avatarMsg.value = err.message
    })
    .finally(() => {
      uploading.value = false
      e.target.value = ''
    })
}

async function saveName() {
  nameErr.value = ''
  nameMsg.value = ''
  const v = name.value.trim()
  if (!v) {
    nameErr.value = '姓名不能为空'
    return
  }
  savingName.value = true
  try {
    const res = await updateMe({ name: v })
    auth.updateProfile(res.user)
    nameMsg.value = '姓名已更新'
    setTimeout(() => (nameMsg.value = ''), 2000)
  } catch (err) {
    nameErr.value = err.message
  }
  savingName.value = false
}

async function savePassword() {
  pwdErr.value = ''
  pwdMsg.value = ''
  if (!oldPassword.value || !newPassword.value) {
    pwdErr.value = '请填写原密码和新密码'
    return
  }
  if (newPassword.value.length < 6) {
    pwdErr.value = '新密码至少 6 位'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    pwdErr.value = '两次输入的新密码不一致'
    return
  }
  savingPwd.value = true
  try {
    await changePassword(oldPassword.value, newPassword.value)
    pwdMsg.value = '密码修改成功，请牢记新密码'
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    setTimeout(() => (pwdMsg.value = ''), 3000)
  } catch (err) {
    pwdErr.value = err.message
  }
  savingPwd.value = false
}

function logout() {
  auth.logout()
  router.push('/')
}

onMounted(() => {
  name.value = auth.user?.name || ''
})
</script>

<template>
  <div class="container settings-page">
    <div class="page-head">
      <h2>个人设置</h2>
      <span class="text-muted">管理你的资料、主题与账号安全</span>
    </div>

    <div class="settings-grid">
      <div class="card settings-card">
        <h3>个人资料</h3>
        <div class="avatar-row">
          <div class="avatar-wrap">
            <img v-if="avatarUrl" :src="avatarUrl" alt="头像" class="avatar-img" />
            <div v-else class="avatar-fallback">{{ initial }}</div>
            <button class="avatar-edit" title="更换头像">
              <input type="file" accept="image/*" class="hidden-input" @change="onAvatarChange" />
              ✎
            </button>
          </div>
          <div class="avatar-info">
            <p class="avatar-name">{{ auth.user?.name || '-' }}</p>
            <p class="avatar-meta">fanbookID：{{ auth.user?.fanbook_id }}</p>
          </div>
        </div>
        <p v-if="avatarMsg" class="text-muted" style="margin-top:10px">{{ avatarMsg }}</p>

        <div class="form-group">
          <label>姓名</label>
          <input v-model="name" class="form-control" maxlength="40" />
        </div>
        <p v-if="nameErr" class="error">{{ nameErr }}</p>
        <p v-if="nameMsg" class="success">{{ nameMsg }}</p>
        <button class="btn btn-primary" :disabled="savingName" @click="saveName">
          {{ savingName ? '保存中...' : '保存姓名' }}
        </button>
      </div>

      <div class="card settings-card">
        <h3>外观</h3>
        <p class="text-muted" style="margin-bottom:12px">选择界面深浅色主题</p>
        <div class="theme-options">
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            class="theme-pick"
            :class="{ active: theme.mode === opt.value }"
            @click="theme.setMode(opt.value)"
          >
            <span class="theme-icon">{{ opt.icon }}</span>
            <span class="theme-label">{{ opt.label }}</span>
            <span class="theme-desc">{{ opt.desc }}</span>
          </button>
        </div>
      </div>

      <div class="card settings-card">
        <h3>修改密码</h3>
        <div class="form-group">
          <label>原密码</label>
          <input v-model="oldPassword" type="password" class="form-control" autocomplete="current-password" />
        </div>
        <div class="form-group">
          <label>新密码（至少 6 位）</label>
          <input v-model="newPassword" type="password" class="form-control" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label>确认新密码</label>
          <input v-model="confirmPassword" type="password" class="form-control" autocomplete="new-password" />
        </div>
        <p v-if="pwdErr" class="error">{{ pwdErr }}</p>
        <p v-if="pwdMsg" class="success">{{ pwdMsg }}</p>
        <button class="btn btn-primary" :disabled="savingPwd" @click="savePassword">
          {{ savingPwd ? '提交中...' : '修改密码' }}
        </button>
      </div>

      <div class="card settings-card">
        <h3>账号</h3>
        <p class="text-muted" style="margin-bottom:12px">
          当前登录身份：
          <span v-if="auth.user?.title" class="title-inline">{{ auth.user.title }}</span>
        </p>
        <button class="btn btn-danger" @click="logout">退出登录</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  padding-top: 18px;
}

.page-head {
  margin-bottom: 18px;
}

.page-head h2 {
  background: linear-gradient(90deg, #e0f2fe, var(--accent), #c4b5fd);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 4px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.settings-card {
  padding: 22px;
}

.settings-card h3 {
  margin-bottom: 16px;
  font-size: 16px;
}

.avatar-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.avatar-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  flex-shrink: 0;
}

.avatar-img,
.avatar-fallback {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(56, 189, 248, 0.4);
  box-shadow: 0 4px 16px rgba(56, 189, 248, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-fallback {
  background: var(--accent-grad);
  color: #fff;
  font-size: 30px;
  font-weight: 700;
}

.avatar-edit {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-card-solid);
  color: var(--text-main);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}

.avatar-name {
  font-weight: 600;
  color: var(--text-main);
}

.avatar-meta {
  font-size: 13px;
  color: var(--text-sub);
  margin-top: 4px;
}

.theme-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.theme-pick {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-elev);
  color: var(--text-main);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}

.theme-pick:hover {
  border-color: var(--accent);
}

.theme-pick.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25), 0 0 14px rgba(56, 189, 248, 0.2);
}

.theme-icon {
  font-size: 20px;
  width: 28px;
  text-align: center;
}

.theme-label {
  font-weight: 600;
  font-size: 14px;
  width: 72px;
}

.theme-desc {
  font-size: 12px;
  color: var(--text-sub);
}

.title-inline {
  color: var(--accent);
}

.error {
  color: var(--red);
  margin-bottom: 10px;
  font-size: 13px;
}

.success {
  color: var(--green);
  margin-bottom: 10px;
  font-size: 13px;
}

.hidden-input {
  display: none;
}
</style>