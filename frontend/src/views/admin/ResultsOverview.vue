<script setup>
import { ref, computed, onMounted } from 'vue'
import { getSchedules, getGroups, getSettings, getMissingLinks, deleteResult } from '../../api'

const schedules = ref([])
const groups = ref([])
const settings = ref({ tournament_name: 'MWLC赛事' })
const loading = ref(true)
const error = ref('')
const groupFilter = ref('')

const missing = ref(null)
const showMissing = ref(false)

const completed = computed(() =>
  schedules.value.filter((s) => s.status === 'completed' && (!groupFilter.value || s.group_name === groupFilter.value))
)

function closeText(s) {
  const r = s.result
  const lines = [
    'CLOSE✅',
    '',
    '对阵',
    `-> ${s.matchup}`,
    '',
    '比赛时间',
    `-> ${s.time}`,
    '',
    '结果',
    `-> ${r?.score || ''}`,
    `-> ${r?.winner || ''}🏆晋级`,
    '',
    `裁判: ${r?.referee_id || ''}`,
    `录像: ${r?.recorder_id || ''}`,
    '',
    `备注:${r?.remark || ''}`
  ]
  return lines.join('\n')
}

async function copy(s) {
  try {
    await navigator.clipboard.writeText(closeText(s))
    alert('已复制 CLOSE 文本')
  } catch (e) {
    alert('复制失败，请手动选择复制')
  }
}

async function queryMissing() {
  showMissing.value = true
  try {
    missing.value = await getMissingLinks()
  } catch (e) {
    error.value = e.message
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [s, g, set] = await Promise.all([getSchedules(), getGroups(), getSettings()])
    schedules.value = s
    groups.value = g
    settings.value = set
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

async function removeResult(s) {
  if (!confirm('确认删除该结果？日程将回到待完成区。')) return
  try {
    await deleteResult(s.result.id)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="toolbar">
      <div class="filters">
        <select v-model="groupFilter" class="form-control filter">
          <option value="">全部组别</option>
          <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
        </select>
        <button class="btn btn-sm" @click="queryMissing">查询缺链接组别</button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="showMissing" class="card missing-card">
      <h3>未上传链接的日程 <span class="text-muted">（共 {{ missing?.total || 0 }} 场）</span></h3>
      <div v-if="!missing || !missing.total" class="empty">所有已完成的日程都已上传链接 ✅</div>
      <div v-else>
        <div v-for="(list, g) in missing.byGroup" :key="g" class="group-block">
          <h4>组别 {{ g }}</h4>
          <div v-for="s in list" :key="s.id" class="missing-item">
            <span>{{ s.round }}-{{ s.seq }}</span>
            <span class="m-matchup">{{ s.matchup }}</span>
            <span class="text-muted">{{ s.result?.score || '' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!completed.length" class="empty">暂无已完成的结果</div>
    <div v-else class="result-list">
      <div v-for="s in completed" :key="s.id" class="card result-item">
        <div class="result-head">
          <span class="badge badge-completed">CLOSE ✅</span>
          <span class="text-muted">{{ settings.tournament_name }} · {{ s.group_name }} · 第{{ s.round }}轮-{{ s.seq }}</span>
        </div>
        <div class="close-box">
          <pre>{{ closeText(s) }}</pre>
        </div>
        <div class="result-actions">
          <button class="btn btn-sm" @click="copy(s)">复制</button>
          <button class="btn btn-sm btn-danger" @click="removeResult(s)">删除结果</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
}

.filters {
  display: flex;
  gap: 10px;
  align-items: center;
}

.filter {
  width: 140px;
}

.error {
  color: var(--red);
  margin-bottom: 12px;
}

.missing-card {
  margin-bottom: 16px;
}

.missing-card h3 {
  margin-bottom: 12px;
}

.group-block {
  margin-bottom: 12px;
}

.group-block h4 {
  margin-bottom: 6px;
}

.missing-item {
  display: flex;
  gap: 12px;
  padding: 6px 10px;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 4px;
  font-size: 14px;
}

.m-matchup {
  flex: 1;
}

.result-item {
  margin-bottom: 16px;
}

.result-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.close-box {
  background: var(--bg-code);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 10px;
  padding: 14px;
  overflow-x: auto;
}

.close-box pre {
  color: #7ee787;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

:root[data-theme="light"] .close-box pre {
  color: #059669;
}

.result-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
</style>
