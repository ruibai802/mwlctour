<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTournamentStore } from '../stores/tournament'
import { useAuthStore } from '../stores/auth'
import { createTournament } from '../api'

const router = useRouter()
const tournament = useTournamentStore()
const auth = useAuthStore()
const loading = ref(true)
const err = ref('')
const creating = ref(false)
const showCreate = ref(false)
const newForm = ref({ code: '', name: '', description: '' })

onMounted(async () => {
  try {
    await tournament.fetchList()
  } catch (e) {
    err.value = e.message
  }
  loading.value = false
})

function enter(t) {
  router.push({ name: 'rules', params: { code: t.code } })
}

async function doCreate() {
  creating.value = true
  err.value = ''
  try {
    const t = await createTournament({
      code: newForm.value.code,
      name: newForm.value.name,
      description: newForm.value.description
    })
    showCreate.value = false
    newForm.value = { code: '', name: '', description: '' }
    await tournament.fetchList()
    enter(t)
  } catch (e) {
    err.value = e.message
  }
  creating.value = false
}
</script>

<template>
  <div class="select-page">
    <div class="container">
      <div class="hero">
        <h1 class="page-title">选择赛事</h1>
        <p class="page-sub">选择一个赛事以查看对应的规则与资料</p>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="err" class="error">{{ err }}</div>

      <div v-else class="tournament-grid">
        <button
          v-for="t in tournament.list"
          :key="t.id"
          class="tournament-card"
          @click="enter(t)"
        >
          <div class="card-top">
            <span class="card-badge">{{ t.code }}</span>
            <span class="card-go">进入 →</span>
          </div>
          <h3 class="card-name">{{ t.name }}</h3>
          <p class="card-desc">{{ t.description || '暂无赛事介绍' }}</p>
        </button>

        <button v-if="auth.canEditRules" class="tournament-card new-card" @click="showCreate = true">
          <div class="card-top">
            <span class="card-badge">+</span>
          </div>
          <h3 class="card-name">新建赛事</h3>
          <p class="card-desc">创建一个新的赛事以开始配置</p>
        </button>
      </div>

      <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
        <div class="modal card">
          <h3>新建赛事</h3>
          <label class="field">
            <span>赛事代码（英文/数字，可进入地址）</span>
            <input v-model.trim="newForm.code" class="form-control" placeholder="如 summer-cup" />
          </label>
          <label class="field">
            <span>赛事名称</span>
            <input v-model.trim="newForm.name" class="form-control" placeholder="如 2026 夏季赛" />
          </label>
          <label class="field">
            <span>赛事介绍（可选）</span>
            <input v-model.trim="newForm.description" class="form-control" placeholder="一句话介绍" />
          </label>
          <div class="modal-actions">
            <button class="btn" @click="showCreate = false">取消</button>
            <button class="btn btn-primary" :disabled="creating" @click="doCreate">
              {{ creating ? '创建中...' : '创建' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.select-page {
  min-height: calc(100vh - 58px);
}

.hero {
  text-align: center;
  padding: 46px 0 30px;
}

.page-title {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: 3px;
  background: linear-gradient(90deg, #e0f2fe, var(--accent), #c4b5fd);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.page-sub {
  color: var(--text-sub);
  margin-top: 10px;
  letter-spacing: 1px;
}

.tournament-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 18px;
}

.tournament-card {
  text-align: left;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 22px;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.2s;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tournament-card:hover {
  transform: translateY(-3px);
  border-color: var(--accent);
  box-shadow: 0 8px 30px rgba(56, 189, 248, 0.15);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-badge {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: var(--accent);
}

.card-go {
  font-size: 12px;
  color: var(--text-dim);
}

.card-name {
  font-size: 18px;
  font-weight: 700;
}

.card-desc {
  font-size: 13px;
  color: var(--text-sub);
  flex: 1;
}

.new-card {
  border-style: dashed;
  background: transparent;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 6px;
}

.new-card:hover {
  border-color: var(--accent);
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal {
  width: min(420px, 92vw);
  padding: 24px;
}

.modal h3 {
  margin-bottom: 16px;
}

.field {
  display: block;
  margin-bottom: 14px;
}

.field span {
  display: block;
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 6px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}
</style>