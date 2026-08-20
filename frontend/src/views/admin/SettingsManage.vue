<script setup>
import { ref, onMounted } from 'vue'
import { getSettings, updateSettings } from '../../api'

const settings = ref({ tournament_name: '', rules_background: '', maps: [], tournament_names: [] })
const loading = ref(true)
const saving = ref(false)
const msg = ref('')
const err = ref('')
const newName = ref('')

async function load() {
  loading.value = true
  try {
    settings.value = await getSettings()
    if (!Array.isArray(settings.value.tournament_names)) settings.value.tournament_names = []
  } catch (e) {
    err.value = e.message
  }
  loading.value = false
}

async function saveName() {
  saving.value = true
  msg.value = ''
  err.value = ''
  try {
    await updateSettings({ tournament_name: settings.value.tournament_name })
    msg.value = '赛事名称已保存 ✅'
    setTimeout(() => (msg.value = ''), 2000)
  } catch (e) {
    err.value = e.message
  }
  saving.value = false
}

async function addName() {
  err.value = ''
  const v = newName.value.trim()
  if (!v) { err.value = '请输入赛事名称'; return }
  if (settings.value.tournament_names.includes(v)) { err.value = '该赛事名称已存在'; return }
  settings.value.tournament_names.push(v)
  newName.value = ''
  await saveNames()
}

async function removeName(n) {
  if (!confirm(`从列表中移除「${n}」？`)) return
  settings.value.tournament_names = settings.value.tournament_names.filter((x) => x !== n)
  await saveNames()
}

async function saveNames() {
  saving.value = true
  msg.value = ''
  err.value = ''
  try {
    await updateSettings({ tournament_names: settings.value.tournament_names })
    msg.value = '赛事名称列表已保存 ✅'
    setTimeout(() => (msg.value = ''), 2000)
  } catch (e) {
    err.value = e.message
  }
  saving.value = false
}

onMounted(load)
</script>

<template>
  <div>
    <div class="card settings-card">
      <h3>赛事名称</h3>
      <p class="text-muted" style="margin-bottom:14px">设置默认赛事名称（显示在规则页等位置）</p>
      <div class="name-row">
        <input v-model="settings.tournament_name" class="form-control name-input" placeholder="输入赛事名称" @keyup.enter="saveName" />
        <button class="btn btn-primary" :disabled="saving" @click="saveName">{{ saving ? '保存中...' : '保存' }}</button>
      </div>
      <p v-if="msg" class="success">{{ msg }}</p>
      <p v-if="err" class="error">{{ err }}</p>
    </div>

    <div class="card settings-card">
      <h3>赛事名称列表 <span class="text-muted">（创建日程时可选择其中一个赛事名称）</span></h3>
      <p class="text-muted" style="margin-bottom:14px">维护本赛事组下所有可选的赛事名称，创建日程/比赛时从中选择</p>
      <div class="name-row">
        <input v-model="newName" class="form-control name-input" placeholder="输入赛事名称后添加" @keyup.enter="addName" />
        <button class="btn btn-primary" :disabled="saving" @click="addName">＋ 添加</button>
      </div>
      <div class="name-list">
        <span v-for="n in settings.tournament_names" :key="n" class="name-chip">
          {{ n }}
          <button class="chip-del" @click="removeName(n)">×</button>
        </span>
        <span v-if="!settings.tournament_names.length" class="text-muted">暂无赛事名称，添加后日程创建时可选择</span>
      </div>
      <p v-if="msg" class="success">{{ msg }}</p>
      <p v-if="err" class="error">{{ err }}</p>
    </div>

    <div class="card settings-card">
      <h3>使用提示</h3>
      <ul class="tips">
        <li>在「选手名单」页批量导入或单个录入选手，创建日程时可一键选择队伍自动填充队员信息</li>
        <li>在「成员管理」页可批量导入裁判/录像名单（支持 fanbookID、姓名、身份、角色列）</li>
        <li>在「数据上传」页上传横幅、选手名单文件，并管理比赛地图</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.settings-card {
  margin-bottom: 16px;
}

.settings-card h3 {
  margin-bottom: 12px;
}

.name-row {
  display: flex;
  gap: 10px;
}

.name-input {
  max-width: 380px;
}

.name-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.name-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: var(--accent);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 13px;
}

.chip-del {
  background: none;
  border: none;
  color: var(--text-sub);
  font-size: 14px;
  cursor: pointer;
  line-height: 1;
}

.chip-del:hover {
  color: var(--red);
}

.success {
  color: var(--green);
  margin-top: 12px;
}

.error {
  color: var(--red);
  margin-top: 12px;
}

.tips {
  padding-left: 20px;
  color: var(--text-sub);
  line-height: 2;
  font-size: 14px;
}
</style>
