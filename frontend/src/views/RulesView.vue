<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTournament } from '../api'

const route = useRoute()
const router = useRouter()

const tournament = ref(null)
const loading = ref(true)
const error = ref('')
const activeAnchor = ref('')
const contentRef = ref(null)
const toc = ref([])
const currentRuleId = ref(null)

const defaultFontSize = 16

const fontSizes = [
  { label: '小', value: 14 },
  { label: '中', value: 16 },
  { label: '大', value: 20 },
  { label: '特大', value: 24 }
]

const fontSize = ref(parseInt(localStorage.getItem('mwlc_rules_font_size') || '', 10) || defaultFontSize)

function setFontSize(v) {
  fontSize.value = v
  localStorage.setItem('mwlc_rules_font_size', String(v))
}

// 当前赛事的全部规则（多规则）
const rulesList = computed(() => (tournament.value && Array.isArray(tournament.value.rules) ? tournament.value.rules : []))
const currentRule = computed(() => rulesList.value.find((r) => String(r.id) === String(currentRuleId.value)) || rulesList.value[0] || null)

function rulesBase() {
  return currentRule.value || { title: '赛事规则', content: '', background: '', content_background: '' }
}

// 从 URL 或默认值设置当前规则
function pickRule() {
  const want = route.params.ruleId
  if (want && rulesList.value.some((r) => String(r.id) === String(want))) {
    currentRuleId.value = String(want)
  } else if (rulesList.value.length) {
    currentRuleId.value = String(rulesList.value[0].id)
  } else {
    currentRuleId.value = null
  }
}

// 切换规则：更新 URL + 重建目录 + 回到顶部
function switchRule(id) {
  if (String(id) === String(currentRuleId.value)) return
  currentRuleId.value = String(id)
  router.replace({ name: 'rules-detail', params: { code: route.params.code, ruleId: String(id) } })
  applyRuleView()
}

function applyRuleView() {
  activeAnchor.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
  buildToc()
}

const bgStyle = computed(() => {
  const bg = (rulesBase().background || '').trim()
  if (!bg) return {}
  if (bg.startsWith('#')) return { background: bg }
  return { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }
})

const contentBgStyle = computed(() => {
  const bg = (rulesBase().content_background || '').trim()
  if (!bg) return { background: 'transparent', backdropFilter: 'none' }
  if (bg.startsWith('#')) return { background: bg }
  return { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
})

const contentStyle = computed(() => ({
  fontSize: `${fontSize.value}px`
}))

// 报名链接：优先当前规则配置的链接，其次赛事级链接
const registrationUrl = computed(() => {
  const ruleUrl = (currentRule.value && (currentRule.value.registration_url || '').trim()) || ''
  if (ruleUrl) return ruleUrl
  return (tournament.value && (tournament.value.registration_url || '').trim()) || ''
})

function buildToc() {
  toc.value = []
  if (!contentRef.value) return
  const doc = new DOMParser().parseFromString(rulesBase().content || '', 'text/html')
  const headings = doc.querySelectorAll('h1, h2, h3')
  headings.forEach((h, i) => {
    const id = `heading-${i}`
    h.setAttribute('id', id)
    toc.value.push({ id, level: parseInt(h.tagName[1], 10), text: h.textContent.trim() })
  })
  const bodyHtml = doc.body.innerHTML
  nextTick(() => {
    if (contentRef.value) contentRef.value.innerHTML = bodyHtml
  })
}

function scrollTo(id) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeAnchor.value = id
  }
}

function onScroll() {
  if (!contentRef.value) return
  const headings = contentRef.value.querySelectorAll('h1, h2, h3')
  let current = ''
  for (const h of headings) {
    if (h.getBoundingClientRect().top <= 120) {
      current = h.id
    }
  }
  activeAnchor.value = current
}

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll, { passive: true })
})

// 直接访问 /rules/:code/:ruleId 时按 URL 选择
watch(() => route.params.ruleId, () => {
  if (tournament.value) {
    pickRule()
    applyRuleView()
  }
})

onMounted(async () => {
  try {
    tournament.value = await getTournament(String(route.params.code || 'default'))
    pickRule()
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
  await new Promise((r) => setTimeout(r, 50))
  buildToc()
  window.addEventListener('scroll', onScroll, { passive: true })
})
</script>

<template>
  <div class="rules-page" :style="bgStyle">
    <div class="container">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <template v-else>
        <div class="hero">
          <h1 class="tournament-name">{{ tournament.name }}</h1>
          <p class="tournament-sub">{{ tournament.description || '赛事规则 · 报名资料 · 数据资料' }}</p>
          <h2 v-if="currentRule" class="rule-title">{{ currentRule.title }}</h2>
          <div v-if="tournament.banners && tournament.banners.length" class="hero-banner">
            <img :src="tournament.banners[0].path" :alt="'赛事横幅'" />
          </div>
          <div class="hero-actions">
            <div class="font-size-group" title="调整规则字号">
              <span class="font-size-label">字号</span>
              <button
                v-for="f in fontSizes"
                :key="f.value"
                class="font-size-btn"
                :class="{ active: fontSize === f.value }"
                @click="setFontSize(f.value)"
              >{{ f.label }}</button>
            </div>
            <a v-if="registrationUrl" :href="registrationUrl" target="_blank" rel="noopener" class="btn btn-primary register-btn">
              报名表 →
            </a>
          </div>
        </div>

        <div v-if="toc.length" class="layout">
          <aside class="toc-side">
            <div class="card toc-card">
              <h4>规则</h4>
              <button
                v-for="r in rulesList"
                :key="r.id"
                class="toc-item rule-item"
                :class="{ active: String(currentRuleId) === String(r.id) }"
                @click="switchRule(r.id)"
              >{{ r.title }}</button>
              <div v-if="!rulesList.length" class="empty">暂无规则</div>
              <h4 class="toc-h4">目录</h4>
              <button
                v-for="item in toc"
                :key="item.id"
                class="toc-item"
                :class="[`lv-${item.level}`, { active: activeAnchor === item.id }]"
                @click="scrollTo(item.id)"
              >{{ item.text }}</button>
            </div>
          </aside>
          <div class="content-area card" :style="contentBgStyle">
            <div ref="contentRef" class="rules-content" :style="contentStyle"></div>
          </div>
        </div>
        <div v-else class="content-area card" :style="contentBgStyle">
          <div ref="contentRef" class="rules-content" :style="contentStyle"></div>
        </div>

        <div v-if="tournament.rosters && tournament.rosters.length" class="roster-section card">
          <h3>选手名单</h3>
          <ul>
            <li v-for="r in tournament.rosters" :key="r.id">
              <a :href="r.path" target="_blank">{{ r.original_name }}</a>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.rules-page {
  min-height: calc(100vh - 58px);
  margin: -22px 0 -44px;
  padding: 22px 0 44px;
  background-attachment: fixed;
  background-size: cover;
  background-position: center;
}

.hero {
  text-align: center;
  padding: 42px 0 26px;
}

.tournament-name {
  font-size: 38px;
  font-weight: 800;
  letter-spacing: 3px;
  background: linear-gradient(90deg, #e0f2fe, var(--accent), #c4b5fd);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 30px rgba(56, 189, 248, 0.3);
}

.tournament-sub {
  color: var(--text-sub);
  margin-top: 10px;
  letter-spacing: 2px;
}

.rule-title {
  margin-top: 10px;
  font-size: 20px;
  font-weight: 700;
  color: var(--accent);
}

.toc-h4 {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.hero-banner {
  margin: 18px auto 0;
  max-width: 880px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(56, 189, 248, 0.25);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3);
}

.hero-banner img {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: cover;
}

.hero-actions {
  margin-top: 18px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.font-size-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-elev);
}

.font-size-label {
  font-size: 12px;
  color: var(--text-sub);
  padding: 0 8px;
}

.font-size-btn {
  min-width: 34px;
  height: 26px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-sub);
  font-size: 12px;
  transition: all 0.15s;
  cursor: pointer;
}

.font-size-btn:hover {
  color: var(--text-main);
}

.font-size-btn.active {
  background: var(--accent-grad);
  color: #fff;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
}

.register-btn {
  animation: pulse 2.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.45); }
  50% { box-shadow: 0 0 0 8px rgba(56, 189, 248, 0); }
}

.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 20px;
  align-items: start;
}

.toc-side {
  position: sticky;
  top: 78px;
}

.toc-card {
  padding: 14px;
}

.toc-card h4 {
  font-size: 14px;
  color: var(--text-sub);
  margin-bottom: 10px;
  letter-spacing: 1px;
}

.toc-item {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-sub);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: all 0.15s;
}

.toc-item:hover {
  background: rgba(56, 189, 248, 0.1);
  color: var(--accent);
}

.toc-item.active {
  background: var(--accent-grad);
  color: #fff;
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.4);
}

.toc-item.lv-2 {
  padding-left: 20px;
}

.toc-item.lv-3 {
  padding-left: 32px;
  font-size: 12px;
}

.content-area {
  padding: 28px 32px;
  background: transparent;
  backdrop-filter: none;
}

.content-area :deep(.rules-content) {
  line-height: 1.9;
}

.content-area :deep(.rules-content h1) { font-size: 1.6em; margin: 0.8em 0 0.5em; }
.content-area :deep(.rules-content h2) { font-size: 1.4em; margin: 0.8em 0 0.4em; }
.content-area :deep(.rules-content h3) { font-size: 1.2em; margin: 0.7em 0 0.35em; }
.content-area :deep(.rules-content p) { margin: 0.5em 0; }
.content-area :deep(.rules-content ul),
.content-area :deep(.rules-content ol) { margin: 0.5em 0; padding-left: 26px; }
.content-area :deep(.rules-content blockquote) {
  border-left: 4px solid var(--accent);
  background: rgba(56, 189, 248, 0.08);
  padding: 10px 14px;
  margin: 12px 0;
}
.content-area :deep(.rules-content a) {
  color: var(--accent);
  text-decoration: underline;
}
.content-area :deep(.rules-content img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  display: block;
  margin: 8px 0;
}
.content-area :deep(.rules-content table) {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  margin: 12px 0;
  overflow: hidden;
  border-radius: 8px;
}
.content-area :deep(.rules-content th),
.content-area :deep(.rules-content td) {
  border: 1px solid var(--border);
  padding: 8px 10px;
  vertical-align: top;
  min-width: 60px;
}
.content-area :deep(.rules-content th) {
  background: rgba(56, 189, 248, 0.12);
  font-weight: 700;
}
.content-area :deep(.rules-content .btn-register),
.content-area :deep(.rules-content a.btn-register) {
  display: inline-block;
  margin: 8px 4px;
  padding: 10px 28px;
  border-radius: 999px;
  background: var(--accent-grad);
  border: none;
  font-size: 1em;
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(56, 189, 248, 0.35);
  transition: transform 0.15s;
}
.content-area :deep(.rules-content .btn-register:hover) {
  transform: translateY(-2px);
}

.roster-section {
  margin-top: 20px;
}

.roster-section h3 {
  margin-bottom: 12px;
}

.roster-section li {
  margin: 8px 0;
}

.roster-section a {
  color: var(--accent);
}

@media (max-width: 760px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .toc-side {
    position: static;
  }
  .content-area {
    padding: 16px;
  }
}
</style>