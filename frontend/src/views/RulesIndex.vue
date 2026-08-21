<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTournament } from '../api'

const route = useRoute()
const router = useRouter()

const tournament = ref(null)
const loading = ref(true)
const err = ref('')

const rules = computed(() => (tournament.value && Array.isArray(tournament.value.rules) ? tournament.value.rules : []))

// 内容摘要：优先服务端 light 摘要，否则去 HTML 标签取纯文本前 80 字
function summary(r) {
  if (r && r.summary) return r.summary
  const html = (r && r.content) || ''
  const text = String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? (text.length > 80 ? text.slice(0, 80) + '…' : text) : '暂无内容'
}

function openRule(r) {
  router.push({ name: 'rules-detail', params: { code: tournament.value.code, ruleId: String(r.id) } })
}

function regUrl(r) {
  const ruleUrl = (r && (r.registration_url || '').trim()) || ''
  if (ruleUrl) return ruleUrl
  return (tournament.value && (tournament.value.registration_url || '').trim()) || ''
}

function register(r, e) {
  e.stopPropagation()
  const url = regUrl(r)
  if (url) window.open(url, '_blank', 'noopener')
}

onMounted(async () => {
  try {
    // 卡片列表页用 light 模式：不拉取规则正文（数 MB），只取标题/链接等，加载更快
    tournament.value = await getTournament(String(route.params.code || 'default'), { light: true })
  } catch (e) {
    err.value = e.message
  }
  loading.value = false
})
</script>

<template>
  <div class="rules-index-page">
    <div class="container">
      <div class="hero">
        <h1 class="page-title">MWLC锦标赛</h1>
        <p class="page-sub">本网页为MWLC锦标赛规则网页，请点击您想选择的赛事进入具体规则页</p>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="err" class="error">{{ err }}</div>

      <div v-else-if="!rules.length" class="empty">暂无规则，请管理员在「规则管理」中创建</div>

      <div v-else class="rule-grid">
        <div
          v-for="(r, i) in rules"
          :key="r.id"
          class="rule-card"
          @click="openRule(r)"
        >
          <div class="card-top">
            <span class="card-badge">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="card-go">查看 →</span>
          </div>
          <h3 class="card-name">{{ r.title }}</h3>
          <p class="card-desc">{{ summary(r) }}</p>
          <div class="card-actions">
            <button
              class="btn btn-sm btn-primary"
              :class="{ 'btn-disabled': !regUrl(r) }"
              :disabled="!regUrl(r)"
              @click="register(r, $event)"
            >{{ regUrl(r) ? '报名表 →' : '暂无报名链接' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rules-index-page {
  min-height: calc(100vh - 58px);
}

.hero {
  text-align: center;
  padding: 42px 0 28px;
}

.page-title {
  font-size: 32px;
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

.rule-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
}

.rule-card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 22px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 170px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rule-card:hover {
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
  color: var(--text-main);
}

.card-desc {
  font-size: 13px;
  color: var(--text-sub);
  flex: 1;
  line-height: 1.7;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
