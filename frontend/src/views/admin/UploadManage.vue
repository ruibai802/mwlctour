<script setup>
import { ref, onMounted } from 'vue'
import { getUploads, uploadDataFile, deleteUpload, getSettings, updateSettings } from '../../api'

const TYPES = [
  { value: 'banner', label: '横幅' },
  { value: 'roster', label: '选手名单' },
  { value: 'map', label: '地图' },
  { value: 'document', label: '文档' },
  { value: 'other', label: '其他' }
]

const activeType = ref('banner')
const uploads = ref([])
const settings = ref({ maps: [] })
const loading = ref(true)
const error = ref('')
const uploading = ref(false)
const selectedFile = ref(null)
const uploadMsg = ref('')

const newMap = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [u, s] = await Promise.all([getUploads(activeType.value), getSettings()])
    uploads.value = u
    settings.value = s
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

function onFileChange(e) {
  selectedFile.value = e.target.files[0] || null
  uploadMsg.value = ''
}

async function upload() {
  uploadMsg.value = ''
  if (!selectedFile.value) {
    error.value = '请选择文件'
    return
  }
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', selectedFile.value)
    fd.append('type', activeType.value)
    await uploadDataFile(fd)
    uploadMsg.value = '上传成功 ✅'
    selectedFile.value = null
    await load()
  } catch (e) {
    error.value = e.message
  }
  uploading.value = false
}

async function remove(u) {
  if (!confirm(`确认删除 ${u.original_name}？`)) return
  try {
    await deleteUpload(u.id)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

async function addMap() {
  const m = newMap.value.trim()
  if (!m) return
  if (settings.value.maps.includes(m)) {
    error.value = '该地图已存在'
    return
  }
  await updateSettings({ maps: [...settings.value.maps, m] })
  newMap.value = ''
  await load()
}

async function removeMap(m) {
  if (!confirm(`确认删除地图 ${m}？`)) return
  await updateSettings({ maps: settings.value.maps.filter((x) => x !== m) })
  await load()
}

onMounted(load)
</script>

<template>
  <div>
    <div class="type-tabs">
      <button
        v-for="t in TYPES"
        :key="t.value"
        class="type-tab"
        :class="{ active: activeType === t.value }"
        @click="activeType = t.value; load()"
      >{{ t.label }}</button>
    </div>

    <div class="card upload-box">
      <h3>上传{{ TYPES.find((t) => t.value === activeType)?.label }}</h3>
      <div class="upload-row">
        <input class="form-control" type="file" @change="onFileChange" />
        <button class="btn btn-primary" :disabled="uploading" @click="upload">{{ uploading ? '上传中...' : '上传' }}</button>
      </div>
      <p v-if="uploadMsg" class="success">{{ uploadMsg }}</p>
      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else>
      <div v-if="!uploads.length" class="empty">暂无{{ TYPES.find((t) => t.value === activeType)?.label }}文件</div>
      <div v-else class="card file-list">
        <div v-for="u in uploads" :key="u.id" class="file-item">
          <template v-if="activeType === 'banner' && /\.(png|jpe?g|gif|webp)$/i.test(u.original_name)">
            <img :src="u.path" class="file-preview" :alt="u.original_name" />
          </template>
          <div class="file-info">
            <a :href="u.path" target="_blank" class="file-name">{{ u.original_name }}</a>
            <div class="text-muted">{{ u.created_at }} · {{ u.uploaded_by }}</div>
          </div>
          <button class="btn btn-sm btn-danger" @click="remove(u)">删除</button>
        </div>
      </div>
    </div>

    <div class="card map-manage">
      <h3>地图管理（供日程选择）</h3>
      <div class="map-row">
        <input v-model="newMap" class="form-control map-input" placeholder="输入地图名称" @keyup.enter="addMap" />
        <button class="btn btn-primary" @click="addMap">添加</button>
      </div>
      <div class="map-list">
        <span v-for="m in settings.maps" :key="m" class="map-chip">
          {{ m }}
          <button class="chip-del" @click="removeMap(m)">×</button>
        </span>
        <span v-if="!settings.maps.length" class="text-muted">暂无地图</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.type-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.type-tab {
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-elev);
  font-size: 13px;
  color: var(--text-sub);
  transition: all 0.15s;
}

.type-tab:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.type-tab.active {
  background: var(--accent-grad);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.35);
}

.upload-box {
  margin-bottom: 16px;
}

.upload-box h3 {
  margin-bottom: 12px;
}

.upload-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.upload-row .form-control {
  flex: 1;
}

.success {
  color: var(--green);
  margin-top: 10px;
}

.error {
  color: var(--red);
  margin-top: 10px;
}

.file-list {
  margin-bottom: 16px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.file-item:last-child {
  border-bottom: none;
}

.file-preview {
  width: 80px;
  height: 50px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.file-info {
  flex: 1;
}

.file-name {
  color: var(--accent);
  font-size: 14px;
}

.map-manage {
  margin-top: 16px;
}

.map-manage h3 {
  margin-bottom: 12px;
}

.map-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.map-input {
  max-width: 260px;
}

.map-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.map-chip {
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
</style>
