<script setup>
import { ref, computed, onMounted } from 'vue'
import { getMatches, getMatch, getGroupList, getSettings } from '../../api'

const matches = ref([])
const details = ref({})
const groups = ref([])
const settings = ref({ tournament_name: 'MWLC赛事' })
const loading = ref(true)
const error = ref('')
const groupFilter = ref('')

const groupName = (id) => {
  const g = groups.value.find((x) => String(x.id) === String(id))
  return g ? g.name : (id ? `组${id}` : '无组别')
}

const completed = computed(() =>
  matches.value.filter((s) => String(s.status) === 'completed' && (!groupFilter.value || String(s.group_id) === String(groupFilter.value)))
)

function staffNames(m) {
  const d = details.value[String(m.id)]
  if (!d || !d.staff) return { referee: '', recorder: '' }
  const referee = d.staff.filter((x) => x.role === 'referee' || x.role === 'referee_chief').map((x) => x.staff_name).join('/')
  const recorder = d.staff.filter((x) => x.role === 'recorder').map((x) => x.staff_name).join('/')
  return { referee, recorder }
}

function closeText(m) {
  const { referee, recorder } = staffNames(m)
  const lines = [
    'CLOSE✅',
    '',
    '对阵',
    `-> ${m.matchup || `${m.team_a_name || '?'} vs ${m.team_b_name || '?'}`}`,
    '',
    '比赛时间',
    `-> ${m.start_time || ''}`,
    '',
    '结果',
    `-> ${m.score || ''}`,
    `-> ${m.winner || ''}🏆晋级`,
    '',
    `裁判: ${referee || m.claimed_referee_name || ''}`,
    `录像: ${recorder || m.claimed_recorder_name || ''}`,
    '',
    `备注:${m.remark || ''}`
  ]
  return lines.join('\n')
}

async function copy(m) {
  try {
    await navigator.clipboard.writeText(closeText(m))
    alert('已复制 CLOSE 文本')
  } catch (e) {
    alert('复制失败，请手动选择复制')
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [m, g, set] = await Promise.all([getMatches(), getGroupList(), getSettings()])
    matches.value = m
    groups.value = g
    settings.value = set
    // 拉取已完成场次的详情（裁判/录像/接取人）
    const done = m.filter((x) => String(x.status) === 'completed')
    const arr = await Promise.all(done.map((x) => getMatch(x.id).catch(() => null)))
    details.value = {}
    arr.forEach((d, i) => {
      if (d) details.value[String(done[i].id)] = d
    })
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

onMounted(load)
</script>

<template>
  <div>
    <div class="toolbar">
      <div class="filters">
        <select v-model="groupFilter" class="form-control filter">
          <option value="">全部组别</option>
          <option v-for="g in groups" :key="g.id" :value="String(g.id)">{{ g.name }}</option>
        </select>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!completed.length" class="empty">暂无已完成的结果</div>
    <div v-else class="result-list">
      <div v-for="m in completed" :key="m.id" class="card result-item">
        <div class="result-head">
          <span class="badge badge-completed">CLOSE ✅</span>
          <span class="text-muted">{{ m.tournament_name || settings.tournament_name }} · {{ groupName(m.group_id) }} · 第{{ m.round }}轮-{{ m.seq }}</span>
        </div>
        <div class="close-box">
          <pre>{{ closeText(m) }}</pre>
        </div>
        <div class="result-actions">
          <button class="btn btn-sm" @click="copy(m)">复制</button>
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
