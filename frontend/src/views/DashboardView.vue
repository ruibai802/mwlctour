<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getSchedules, getSettings, getMissingLinks, changePassword } from '../api'

const router = useRouter()
const activeTab = ref('pending')
const schedules = ref([])
const settings = ref({ tournament_name: 'MWLC赛事' })
const loading = ref(true)
const error = ref('')
const missingLinks = ref(null)
const showMissing = ref(false)

const showPwd = ref(false)
const pwdForm = ref({ old_password: '', new_password: '', confirm: '' })
const pwdMsg = ref('')
const pwdError = ref('')

const filtered = computed(() => schedules.value)

const pendingList = computed(() => filtered.value.filter((s) => s.status === 'pending'))
const completedList = computed(() => filtered.value.filter((s) => s.status === 'completed'))

function briefLabel(s) {
  return `${settings.value.tournament_name} | ${s.group_name || '无组别'} | ${s.round}-${s.seq} | ${s.matchup || '未填写对阵'}`
}

function openDetail(id) {
  router.push(`/schedule/${id}`)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [s, set] = await Promise.all([getSchedules(), getSettings()])
    schedules.value = s
    settings.value = set
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

async function queryMissing() {
  showMissing.value = true
  try {
    missingLinks.value = await getMissingLinks()
  } catch (e) {
    missingLinks.value = { total: 0, byGroup: {} }
    error.value = e.message
  }
}

function groupBadge(s) {
  if (!s.result) return null
  const links = s.result.game_links || []
  return links.length ? '✅ 已传' : '⚠️ 缺链接'
}

async function submitPwd() {
  pwdMsg.value = ''
  pwdError.value = ''
  if (pwdForm.value.new_password.length < 6) {
    pwdError.value = '新密码至少 6 位'
    return
  }
  if (pwdForm.value.new_password !== pwdForm.value.confirm) {
    pwdError.value = '两次输入的新密码不一致'
    return
  }
  try {
    await changePassword(pwdForm.value.old_password, pwdForm.value.new_password)
    pwdMsg.value = '密码修改成功'
    pwdForm.value = { old_password: '', new_password: '', confirm: '' }
    setTimeout(() => { showPwd.value = false; pwdMsg.value = '' }, 1200)
  } catch (e) {
    pwdError.value = e.message
  }
}

onMounted(load)
</script>

<template>
  <div class="container">
    <div class="page-head">
      <h2>裁判工作台</h2>
      <div class="head-actions">
        <button class="btn btn-sm" @click="queryMissing">查询缺链接组别</button>
        <button class="btn btn-sm" @click="showPwd = true">修改密码</button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="tabs">
      <button class="tab" :class="{ active: activeTab === 'pending' }" @click="activeTab = 'pending'">
        待完成 <span class="count">{{ pendingList.length }}</span>
      </button>
      <button class="tab" :class="{ active: activeTab === 'completed' }" @click="activeTab = 'completed'">
        已完成 <span class="count">{{ completedList.length }}</span>
      </button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else>
      <div v-if="activeTab === 'pending'">
        <div v-if="!pendingList.length" class="empty">暂无待完成的日程</div>
        <div v-else class="schedule-grid">
          <div
            v-for="s in pendingList"
            :key="s.id"
            class="card schedule-card pending"
            @click="openDetail(s.id)"
          >
            <div class="card-top">
              <span class="badge badge-pending">待完成</span>
              <span class="text-muted">{{ s.time }}</span>
            </div>
            <div class="brief">{{ briefLabel(s) }}</div>
            <div class="tags">
              <span class="tag">房间 {{ s.room }}</span>
              <span class="tag" v-if="s.map">地图 {{ s.map }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else>
        <div v-if="!completedList.length" class="empty">暂无已完成的日程</div>
        <div v-else class="schedule-grid">
          <div
            v-for="s in completedList"
            :key="s.id"
            class="card schedule-card completed"
            @click="openDetail(s.id)"
          >
            <div class="card-top">
              <span class="badge badge-completed">已完成</span>
              <span v-if="groupBadge(s)" class="badge" :class="groupBadge(s).startsWith('✅') ? 'badge-completed' : 'badge-pending'">{{ groupBadge(s) }}</span>
              <span class="text-muted">{{ s.time }}</span>
            </div>
            <div class="brief">{{ briefLabel(s) }}</div>
            <div class="result-line" v-if="s.result">
              <span class="score">{{ s.result.score }}</span>
              <span class="winner">🏆 {{ s.result.winner }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showMissing" class="card missing-card">
      <h3>未上传链接的日程 <span class="text-muted">（共 {{ missingLinks?.total || 0 }} 场）</span></h3>
      <div v-if="!missingLinks || !missingLinks.total" class="empty">所有已完成的日程都已上传链接 ✅</div>
      <div v-else>
        <div v-for="(list, g) in missingLinks.byGroup" :key="g" class="group-block">
          <h4>组别 {{ g }}</h4>
          <div v-for="s in list" :key="s.id" class="missing-item" @click="openDetail(s.id)">
            <span>{{ s.round }}-{{ s.seq }}</span>
            <span class="m-matchup">{{ s.matchup }}</span>
            <span class="btn btn-sm btn-primary">补链接</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showPwd" class="modal-mask" @click.self="showPwd = false">
      <div class="modal">
        <h3>修改密码</h3>
        <div class="form-group">
          <label>原密码</label>
          <input v-model="pwdForm.old_password" class="form-control" type="password" />
        </div>
        <div class="form-group">
          <label>新密码</label>
          <input v-model="pwdForm.new_password" class="form-control" type="password" />
        </div>
        <div class="form-group">
          <label>确认新密码</label>
          <input v-model="pwdForm.confirm" class="form-control" type="password" />
        </div>
        <p v-if="pwdMsg" class="success">{{ pwdMsg }}</p>
        <p v-if="pwdError" class="error">{{ pwdError }}</p>
        <div class="modal-actions">
          <button class="btn" @click="showPwd = false">取消</button>
          <button class="btn btn-primary" @click="submitPwd">确认修改</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-head h2 {
  background: linear-gradient(90deg, #e0f2fe, var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.head-actions {
  display: flex;
  gap: 8px;
}

.error {
  color: var(--red);
  margin-bottom: 12px;
}

.success {
  color: var(--green);
  margin-bottom: 12px;
}

.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 18px;
}

.tab {
  padding: 10px 20px;
  background: none;
  border: none;
  font-size: 15px;
  color: var(--text-sub);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.15s;
}

.tab:hover {
  color: var(--text-main);
}

.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
  text-shadow: 0 0 12px rgba(56, 189, 248, 0.5);
}

.count {
  background: rgba(148, 163, 184, 0.2);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 12px;
  margin-left: 4px;
}

.tab.active .count {
  background: rgba(56, 189, 248, 0.2);
  color: var(--accent);
}

.schedule-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}

.schedule-card {
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
  border-top: 3px solid rgba(251, 191, 36, 0.7);
  position: relative;
  overflow: hidden;
}

.schedule-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, rgba(251, 191, 36, 0.06), transparent 40%);
  pointer-events: none;
}

.schedule-card.completed {
  border-top-color: rgba(52, 211, 153, 0.7);
}

.schedule-card.completed::before {
  background: linear-gradient(120deg, rgba(52, 211, 153, 0.07), transparent 40%);
}

.schedule-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-glow);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4), 0 0 20px rgba(56, 189, 248, 0.15);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  gap: 8px;
  position: relative;
}

.brief {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  position: relative;
}

.result-line {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 14px;
  position: relative;
}

.score {
  font-weight: 700;
  color: var(--accent);
}

.winner {
  color: var(--amber);
}

.missing-card {
  margin-top: 20px;
}

.missing-card h3 {
  margin-bottom: 12px;
}

.group-block {
  margin-bottom: 14px;
}

.group-block h4 {
  margin-bottom: 8px;
  color: var(--text-main);
}

.missing-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.missing-item:hover {
  border-color: var(--accent);
}

.m-matchup {
  flex: 1;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
}

.modal {
  background: var(--bg-card-solid);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 14px;
  padding: 26px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.1);
}

.modal h3 {
  margin-bottom: 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
</style>
