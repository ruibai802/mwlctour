<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getSchedule, getSettings, uploadResult, updateResult, updateResultLinks } from '../api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const schedule = ref(null)
const settings = ref({ tournament_name: 'MWLC赛事' })
const loading = ref(true)
const error = ref('')

const resultForm = ref({
  score: '',
  winner: '',
  referee_id: auth.user?.fanbook_id || '',
  recorder_id: '',
  remark: ''
})
const screenshotFiles = ref([])
const submitting = ref(false)
const formMsg = ref('')
const formError = ref('')

const linkForm = ref({ count: 1, links: [''] })
const linkMsg = ref('')
const linkError = ref('')

const isOfficial = computed(() => auth.user && ['official', 'admin', 'superadmin'].includes(auth.user.role))
const isAdmin = computed(() => auth.user && ['admin', 'superadmin'].includes(auth.user.role))
const canEditResult = computed(() => {
  if (!schedule.value || !schedule.value.result) return isOfficial.value
  const r = schedule.value.result
  return (
    isAdmin.value ||
    String(auth.user?.fanbook_id) === String(r.referee_id) ||
    String(auth.user?.fanbook_id) === String(r.recorder_id)
  )
})
const canEditLinks = computed(() => {
  if (!schedule.value || !schedule.value.result) return false
  const r = schedule.value.result
  return isAdmin.value || String(auth.user?.fanbook_id) === String(r.recorder_id)
})
const hasResult = computed(() => !!schedule.value?.result)

function refreshLinkForm() {
  const r = schedule.value?.result
  const links = (r && r.game_links) || []
  if (links.length) {
    linkForm.value = { count: links.length, links: [...links] }
  } else {
    linkForm.value = { count: 1, links: [''] }
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [s, set] = await Promise.all([getSchedule(route.params.id), getSettings()])
    schedule.value = s
    settings.value = set
    if (s.result) {
      resultForm.value = {
        score: s.result.score || '',
        winner: s.result.winner || '',
        referee_id: s.result.referee_id || '',
        recorder_id: s.result.recorder_id || '',
        remark: s.result.remark || ''
      }
    }
    refreshLinkForm()
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

function onScreenshotsChange(e) {
  const files = Array.from(e.target.files || [])
  if (files.length > 10) {
    formError.value = '最多上传 10 张截图'
    e.target.value = ''
    return
  }
  for (const f of files) {
    if (f.size > 15 * 1024 * 1024) {
      formError.value = `文件 ${f.name} 超过 15MB`
      e.target.value = ''
      return
    }
  }
  screenshotFiles.value = files
  formError.value = ''
}

async function submitResult() {
  formError.value = ''
  formMsg.value = ''
  if (!resultForm.value.score) {
    formError.value = '请填写比分'
    return
  }
  if (!resultForm.value.referee_id) {
    formError.value = '请填写裁判ID'
    return
  }
  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('schedule_id', schedule.value.id)
    fd.append('score', resultForm.value.score)
    fd.append('winner', resultForm.value.winner)
    fd.append('referee_id', resultForm.value.referee_id)
    fd.append('recorder_id', resultForm.value.recorder_id)
    fd.append('remark', resultForm.value.remark)
    for (const f of screenshotFiles.value) fd.append('screenshots', f)
    if (hasResult.value) {
      await updateResult(schedule.value.result.id, fd)
    } else {
      await uploadResult(fd)
    }
    formMsg.value = '结果上传成功，日程已移入已完成区 ✅'
    screenshotFiles.value = []
    await load()
  } catch (e) {
    formError.value = e.message
  }
  submitting.value = false
}

function setLinkCount(n) {
  n = Math.max(1, Math.min(7, parseInt(n, 10) || 1))
  const arr = new Array(n).fill('')
  for (let i = 0; i < n && i < linkForm.value.links.length; i++) arr[i] = linkForm.value.links[i]
  linkForm.value = { count: n, links: arr }
}

async function submitLinks() {
  linkError.value = ''
  linkMsg.value = ''
  const links = linkForm.value.links.map((l) => l.trim()).filter(Boolean)
  if (!links.length) {
    linkError.value = '请至少填写一个链接'
    return
  }
  if (links.length > 7) {
    linkError.value = '最多提供 7 局链接'
    return
  }
  try {
    await updateResultLinks(schedule.value.result.id, links)
    linkMsg.value = '链接上传成功 ✅'
    await load()
  } catch (e) {
    linkError.value = e.message
  }
}

function back() {
  router.push('/dashboard')
}
</script>

<template>
  <div class="container">
    <button class="btn btn-sm back-btn" @click="back">← 返回工作台</button>

    <div v-if="loading" class="loading">加载中...</div>
    <template v-else-if="schedule">
      <p v-if="error" class="error">{{ error }}</p>

      <div class="card detail-card">
        <div class="detail-head">
          <h2>{{ settings.tournament_name }}</h2>
          <span class="badge" :class="schedule.status === 'completed' ? 'badge-completed' : 'badge-pending'">
            {{ schedule.status === 'completed' ? '已完成' : '待完成' }}
          </span>
        </div>

        <div class="detail-grid">
          <div class="d-item">
            <span class="d-label">轮次</span>
            <span class="d-value">{{ schedule.round }}</span>
          </div>
          <div class="d-item">
            <span class="d-label">序号</span>
            <span class="d-value">{{ schedule.seq }}</span>
          </div>
          <div class="d-item">
            <span class="d-label">对阵</span>
            <span class="d-value">{{ schedule.matchup }}</span>
          </div>
          <div class="d-item">
            <span class="d-label">房间号</span>
            <span class="d-value">{{ schedule.room }}</span>
          </div>
          <div class="d-item">
            <span class="d-label">比赛时间</span>
            <span class="d-value">{{ schedule.time }}</span>
          </div>
          <div class="d-item">
            <span class="d-label">地图</span>
            <span class="d-value">{{ schedule.map || '未指定' }}</span>
          </div>
        </div>

        <div class="team-block" v-if="schedule.team_a_name || schedule.team_b_name">
          <div class="team" v-if="schedule.team_a_name">
            <h4>队伍名：{{ schedule.team_a_name }}</h4>
            <ul v-if="(schedule.team_a_lineup || []).length">
              <li v-for="p in schedule.team_a_lineup" :key="p.slot || p.name">
                <span class="lbl">{{ p.slot || '?' }}</span>
                <template v-if="p.fanbook">@{{ p.fanbook }} · </template>{{ p.name }} · {{ p.game_id }}
              </li>
            </ul>
            <ul v-else>
              <li><span class="lbl">T1（队长）</span> @{{ schedule.t1_a_fb }} · {{ schedule.t1_a_name }} · {{ schedule.t1_a_id }}</li>
              <li><span class="lbl">T2</span> {{ schedule.t2_a_name }} · {{ schedule.t2_a_id }}</li>
              <li><span class="lbl">替补</span> {{ schedule.sub_a_name }} · {{ schedule.sub_a_id }}</li>
            </ul>
          </div>
          <div class="team" v-if="schedule.team_b_name">
            <h4>队伍名：{{ schedule.team_b_name }}</h4>
            <ul v-if="(schedule.team_b_lineup || []).length">
              <li v-for="p in schedule.team_b_lineup" :key="p.slot || p.name">
                <span class="lbl">{{ p.slot || '?' }}</span>
                <template v-if="p.fanbook">@{{ p.fanbook }} · </template>{{ p.name }} · {{ p.game_id }}
              </li>
            </ul>
            <ul v-else>
              <li><span class="lbl">T1（队长）</span> @{{ schedule.t1_b_fb }} · {{ schedule.t1_b_name }} · {{ schedule.t1_b_id }}</li>
              <li><span class="lbl">T2</span> {{ schedule.t2_b_name }} · {{ schedule.t2_b_id }}</li>
              <li><span class="lbl">替补</span> {{ schedule.sub_b_name }} · {{ schedule.sub_b_id }}</li>
            </ul>
          </div>
        </div>

        <div class="tags" v-if="schedule.tags">
          <span v-for="t in schedule.tags.split('\n').filter(Boolean)" :key="t" class="tag">{{ t }}</span>
        </div>
        <p class="text-muted" v-if="schedule.remark">备注：{{ schedule.remark }}</p>
      </div>

      <!-- 结果展示 -->
      <div v-if="hasResult" class="card result-card">
        <h3>比赛结果</h3>
        <div class="result-display">
          <p><span class="lbl">比分</span> {{ schedule.result.score }}</p>
          <p v-if="schedule.result.winner"><span class="lbl">胜者</span> {{ schedule.result.winner }} 🏆晋级</p>
          <p><span class="lbl">裁判</span> {{ schedule.result.referee_id }}</p>
          <p><span class="lbl">录像</span> {{ schedule.result.recorder_id || '未指定' }}</p>
          <p v-if="schedule.result.remark"><span class="lbl">备注</span> {{ schedule.result.remark }}</p>
        </div>
        <div v-if="schedule.result.screenshots && schedule.result.screenshots.length" class="shots">
          <a v-for="(img, i) in schedule.result.screenshots" :key="i" :href="img" target="_blank">
            <img :src="img" :alt="`截图${i + 1}`" />
          </a>
        </div>
        <div v-if="(schedule.result.game_links || []).length" class="links">
          <p class="lbl">比赛链接</p>
          <a v-for="(l, i) in schedule.result.game_links" :key="i" :href="l" target="_blank" class="link-item">
            第{{ i + 1 }}局：{{ l }}
          </a>
        </div>
      </div>

      <!-- 裁判上传结果 -->
      <div v-if="canEditResult" class="card form-card">
        <h3>{{ hasResult ? '修改结果' : '上传结果' }}</h3>
        <p class="text-muted">结果上传后该日程将移入已完成区</p>
        <div class="form-row">
          <div class="form-group">
            <label>比分</label>
            <input v-model="resultForm.score" class="form-control" placeholder="如 2:1" />
          </div>
          <div class="form-group">
            <label>胜者队伍（自动按比分推断，可改）</label>
            <input v-model="resultForm.winner" class="form-control" placeholder="胜者队伍名" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>裁判ID（fanbookID）</label>
            <input v-model="resultForm.referee_id" class="form-control" />
          </div>
          <div class="form-group">
            <label>录像ID（fanbookID）</label>
            <input v-model="resultForm.recorder_id" class="form-control" />
          </div>
        </div>
        <div class="form-group">
          <label>截图（最多 10 张，每张不超过 15MB）</label>
          <input class="form-control" type="file" accept="image/*" multiple @change="onScreenshotsChange" />
          <span v-if="screenshotFiles.length" class="text-muted">已选择 {{ screenshotFiles.length }} 张</span>
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea v-model="resultForm.remark" class="form-control" rows="3"></textarea>
        </div>
        <p v-if="formMsg" class="success">{{ formMsg }}</p>
        <p v-if="formError" class="error">{{ formError }}</p>
        <button class="btn btn-primary" :disabled="submitting" @click="submitResult">
          {{ submitting ? '上传中...' : hasResult ? '保存修改' : '上传结果' }}
        </button>
      </div>

      <!-- 录像添加链接 -->
      <div v-if="hasResult && canEditLinks" class="card form-card">
        <h3>添加比赛链接</h3>
        <p class="text-muted">按局填写视频链接，最多提供到第 7 局</p>
        <div class="form-group">
          <label>局数</label>
          <select class="form-control" :value="linkForm.count" @change="setLinkCount($event.target.value)">
            <option v-for="n in 7" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
        <div v-for="(_, i) in linkForm.links" :key="i" class="form-group">
          <label>第 {{ i + 1 }} 局链接</label>
          <input v-model="linkForm.links[i]" class="form-control" placeholder="https://..." />
        </div>
        <p v-if="linkMsg" class="success">{{ linkMsg }}</p>
        <p v-if="linkError" class="error">{{ linkError }}</p>
        <button class="btn btn-success" @click="submitLinks">保存链接</button>
      </div>

      <div v-else-if="isOfficial && hasResult && !canEditLinks" class="card form-card">
        <p class="text-muted">您不是本场的录像/裁判，无法添加链接。可联系管理员绑定录像ID。</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.back-btn {
  margin-bottom: 16px;
}

.error {
  color: var(--red);
  margin-bottom: 12px;
}

.success {
  color: var(--green);
  margin-bottom: 12px;
}

.detail-card {
  margin-bottom: 16px;
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.detail-head h2 {
  font-size: 22px;
  background: linear-gradient(90deg, #e0f2fe, var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.d-item {
  background: rgba(148, 163, 184, 0.07);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  transition: border-color 0.15s;
}

.d-item:hover {
  border-color: rgba(56, 189, 248, 0.4);
}

.d-label {
  display: block;
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.d-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
}

.team-block {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.team {
  background: rgba(56, 189, 248, 0.06);
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-radius: 12px;
  padding: 14px;
}

.team h4 {
  font-size: 15px;
  margin-bottom: 10px;
  color: var(--accent);
}

.team li {
  list-style: none;
  margin: 6px 0;
  font-size: 14px;
  color: var(--text-main);
}

.lbl {
  color: var(--text-dim);
  font-size: 13px;
  margin-right: 6px;
}

.tags {
  margin-top: 4px;
}

.result-card,
.form-card {
  margin-bottom: 16px;
}

.result-card h3,
.form-card h3 {
  margin-bottom: 12px;
}

.result-display p {
  margin: 6px 0;
}

.shots {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.shots img {
  width: 120px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid var(--border);
  transition: box-shadow 0.15s;
}

.shots img:hover {
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.3);
}

.links {
  margin-top: 12px;
}

.link-item {
  display: block;
  color: var(--accent);
  margin: 4px 0;
  font-size: 13px;
  word-break: break-all;
}

@media (max-width: 760px) {
  .team-block {
    grid-template-columns: 1fr;
  }
}
</style>
