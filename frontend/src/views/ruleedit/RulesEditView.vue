<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { useTournamentStore } from '../../stores/tournament'
import { updateTournament, uploadDataFile, deleteUpload, uploadEditorImage, getUploads, createRule as apiCreateRule, updateRule as apiUpdateRule, deleteRule as apiDeleteRule } from '../../api'
import Image from '../../editor/imageExtension'

const tournament = useTournamentStore()
const loading = ref(true)
const saving = ref(false)
const msg = ref('')
const err = ref('')
const colorVal = ref('#000000')
const bgColorVal = ref('#ffffff')

const name = ref('')
const description = ref('')
const registrationUrl = ref('')

const FontSize = TextStyle.extend({
  name: 'fontSize',
  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (el) => el.style.fontSize || null,
        renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {})
      }
    }
  },
  addCommands() {
    return {
      setFontSize: (size) => ({ chain }) => chain().focus().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) => chain().focus().unsetMark('textStyle').run()
    }
  }
})

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit.configure({ link: false }),
    Underline,
    TextStyle,
    FontSize,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https'
    }),
    Table.configure({
      resizable: false,
      allowTableNodeSelection: true
    }),
    TableRow,
    TableHeader,
    TableCell,
    Image
  ],
  editorProps: {
    attributes: {
      class: 'rules-editor-content'
    }
  }
})

const fontSizes = [12, 14, 16, 18, 20, 24, 28]
const currentFontSize = computed(() => {
  if (!editor.value) return '16'
  const attrs = editor.value.getAttributes('textStyle')
  return attrs.fontSize || '16'
})

const bgPresets = [
  { label: '透明', value: '' },
  { label: '白色', value: '#ffffff' },
  { label: '米色', value: '#fdf6e3' },
  { label: '浅蓝', value: '#e8f1fb' },
  { label: '浅绿', value: '#eef7ee' },
  { label: '浅粉', value: '#fbeef3' }
]

const contentBgPresets = [
  { label: '透明', value: '' },
  { label: '白色', value: '#ffffff' },
  { label: '米色', value: '#fdf6e3' },
  { label: '浅蓝', value: '#e8f1fb' },
  { label: '浅绿', value: '#eef7ee' },
  { label: '浅粉', value: '#fbeef3' }
]

const background = ref('')
const contentBg = ref('')

// ===== 多规则管理 =====
const rulesList = ref([])
const currentRuleId = ref(null)
const currentRule = computed(() => rulesList.value.find((r) => String(r.id) === String(currentRuleId.value)) || rulesList.value[0] || null)

const banners = computed(() => (tournament.current && tournament.current.banners) || [])

const currentBgLabel = computed(() => {
  if (!background.value) return '无背景'
  if (background.value.startsWith('#')) return `颜色 ${background.value}`
  const b = banners.value.find((x) => x.path === background.value)
  return b ? `图片 ${b.original_name}` : '图片'
})

const backgroundDot = computed(() => {
  if (!background.value) return { background: 'transparent' }
  if (background.value.startsWith('#')) return { background: background.value }
  return { backgroundImage: `url(${background.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
})

function isActive(name) {
  return editor.value?.isActive(name) ?? false
}

function applyColor(e) {
  colorVal.value = e.target.value
  editor.value?.chain().focus().setColor(e.target.value).run()
}

const currentTextColor = computed(() => {
  if (!editor.value) return ''
  return editor.value.getAttributes('textStyle').color || ''
})

function applyTextColor(e) {
  const v = e.target.value
  if (v === '') {
    editor.value?.chain().focus().unsetColor().run()
  } else {
    editor.value?.chain().focus().setColor(v).run()
  }
  if (v !== 'transparent') colorVal.value = v
}

function applyBgColor(e) {
  bgColorVal.value = e.target.value
  editor.value?.chain().focus().setHighlight({ color: e.target.value }).run()
}

const currentHighlight = computed(() => {
  if (!editor.value) return ''
  const attrs = editor.value?.getAttributes('highlight') || {}
  return attrs.color || ''
})

function applyHighlight(e) {
  const v = e.target.value
  if (v === '') {
    editor.value?.chain().focus().unsetHighlight().run()
  } else {
    editor.value?.chain().focus().setHighlight({ color: v }).run()
  }
  if (v !== 'transparent') bgColorVal.value = v
}

function setLink() {
  if (!editor.value) return
  const prev = editor.value.getAttributes('link').href
  const url = window.prompt('请输入链接地址', prev || 'https://')
  if (url === null) return
  if (url === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

function applyFontSize(e) {
  const v = e.target.value
  if (!v) {
    editor.value?.chain().focus().unsetFontSize().run()
    return
  }
  editor.value?.chain().focus().setFontSize(`${v}px`).run()
}

function insertRegisterButton() {
  if (!editor.value) return
  const url = window.prompt('请输入报名表链接地址', 'https://')
  if (url === null || !url.trim()) return
  editor.value
    .chain()
    .focus()
    .insertContent(`<p><a class="btn-register" href="${url.trim()}" target="_blank" rel="noopener">报名表</a></p>`)
    .run()
}

function insertTable() {
  if (!editor.value) return
  editor.value
    .chain()
    .focus()
    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
    .run()
}

// 光标在表格单元格内时插入即为内嵌表格（TableCell 内容为 block+，天然支持嵌套）
function insertNestedTable() {
  if (!editor.value) return
  editor.value
    .chain()
    .focus()
    .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
    .run()
}

// ---- 内嵌图片 ----
const imageInput = ref(null)
const uploadingImage = ref(false)
const imgError = ref('')

function pickImage() {
  imgError.value = ''
  imageInput.value?.click()
}

async function onInsertImage(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    imgError.value = '仅支持图片文件'
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    imgError.value = '图片不能超过 10MB'
    return
  }
  uploadingImage.value = true
  imgError.value = ''
  try {
    const fd = new FormData()
    fd.append('file', file)
    const up = await uploadEditorImage(fd)
    editor.value?.chain().focus().setImage({ src: up.path, alt: file.name }).run()
    msg.value = '图片已插入，可选中图片调整宽度'
    setTimeout(() => (msg.value = ''), 2500)
  } catch (err) {
    imgError.value = err.message
  }
  uploadingImage.value = false
}

const currentImageWidth = computed(() => {
  if (!editor.value) return ''
  return editor.value.getAttributes('image').width || ''
})

function applyImageWidth(e) {
  if (!editor.value) return
  const v = e.target.value
  editor.value.chain().focus().updateImage({ width: v || null }).run()
}

// 仅从正文移除图片节点（服务器文件保留，可再插入）
function removeImageOnly() {
  if (!editor.value) return
  editor.value.chain().focus().deleteNode('image').run()
}

// 从正文移除图片，并删除服务器上的图片文件
async function removeImageFile() {
  const src = editor.value?.getAttributes('image').src || ''
  editor.value?.chain().focus().deleteNode('image').run()
  if (!src) return
  try {
    const list = await getUploads('editor-image')
    const rec = list.find((u) => u.path === src)
    if (rec) {
      await deleteUpload(rec.id)
      msg.value = '图片已从规则与服务器删除'
    }
    setTimeout(() => (msg.value = ''), 2500)
  } catch (err) {
    err.value = err.message
  }
}

function applyRuleToEditor() {
  const r = currentRule.value
  background.value = (r && r.background) || ''
  contentBg.value = (r && r.content_background) || ''
  ruleRegUrl.value = (r && r.registration_url) || ''
  if (editor.value) {
    editor.value.commands.setContent((r && r.content) || '')
  }
}

// 当前规则的报名链接
const ruleRegUrl = ref('')

async function saveRuleRegUrl() {
  if (!currentRule.value) return
  err.value = ''
  try {
    await apiUpdateRule(currentRule.value.id, { registration_url: ruleRegUrl.value.trim() })
    const idx = rulesList.value.findIndex((x) => x.id === currentRule.value.id)
    if (idx >= 0) rulesList.value[idx] = { ...rulesList.value[idx], registration_url: ruleRegUrl.value.trim() }
    msg.value = '报名链接已保存'
    setTimeout(() => (msg.value = ''), 2000)
  } catch (e) {
    err.value = e.message
  }
}

function syncFromCurrent() {
  const c = tournament.current || {}
  name.value = c.name || ''
  description.value = c.description || ''
  registrationUrl.value = (c.registration_url || '').trim()
  rulesList.value = Array.isArray(c.rules) ? [...c.rules] : []
  if (!rulesList.value.some((r) => String(r.id) === String(currentRuleId.value))) {
    currentRuleId.value = rulesList.value.length ? String(rulesList.value[0].id) : null
  }
  applyRuleToEditor()
}

// 保存当前规则内容（不存赛事信息）
async function saveRuleContent(rule) {
  if (!rule || !editor.value) return
  await apiUpdateRule(rule.id, {
    title: rule.title,
    content: editor.value.getHTML() || '',
    background: background.value,
    content_background: contentBg.value
  })
}

async function save() {
  if (!tournament.current) return
  saving.value = true
  msg.value = ''
  err.value = ''
  try {
    // 赛事信息
    await updateTournament(tournament.current.id, {
      name: name.value,
      description: description.value,
      registration_url: registrationUrl.value
    })
    // 当前规则内容
    if (currentRule.value) {
      const html = editor.value?.getHTML() || ''
      await apiUpdateRule(currentRule.value.id, {
        title: currentRule.value.title,
        content: html,
        background: background.value,
        content_background: contentBg.value
      })
      const idx = rulesList.value.findIndex((r) => r.id === currentRule.value.id)
      if (idx >= 0) {
        rulesList.value[idx] = { ...rulesList.value[idx], content: html, background: background.value, content_background: contentBg.value }
      }
    }
    msg.value = '保存成功'
    setTimeout(() => (msg.value = ''), 2000)
    await tournament.fetchCurrent()
  } catch (e) {
    err.value = e.message
  }
  saving.value = false
}

// 切换规则：先保存当前规则内容，再载入目标规则
async function switchRule(id) {
  if (String(id) === String(currentRuleId.value)) return
  err.value = ''
  try {
    if (currentRule.value && editor.value) await saveRuleContent(currentRule.value)
    currentRuleId.value = String(id)
    applyRuleToEditor()
    msg.value = '已切换到该规则（内容已自动保存）'
    setTimeout(() => (msg.value = ''), 2000)
  } catch (e) {
    err.value = e.message
  }
}

async function createRule() {
  err.value = ''
  const title = window.prompt('请输入新规则的标题', '')
  if (title === null) return
  const t = String(title).trim()
  if (!t) { err.value = '标题不能为空'; return }
  try {
    if (currentRule.value && editor.value) await saveRuleContent(currentRule.value)
    const row = await apiCreateRule({ title: t })
    await tournament.fetchCurrent()
    rulesList.value = [...(tournament.current.rules || [])]
    currentRuleId.value = String(row.id)
    applyRuleToEditor()
    msg.value = '规则已创建，可直接编辑内容'
    setTimeout(() => (msg.value = ''), 2500)
  } catch (e) {
    err.value = e.message
  }
}

async function renameRule() {
  if (!currentRule.value) return
  err.value = ''
  const title = window.prompt('请输入新的规则标题', currentRule.value.title)
  if (title === null) return
  const t = String(title).trim()
  if (!t) { err.value = '标题不能为空'; return }
  try {
    await saveRuleContent(currentRule.value)
    const r = currentRule.value
    await apiUpdateRule(r.id, { title: t })
    const idx = rulesList.value.findIndex((x) => x.id === r.id)
    if (idx >= 0) rulesList.value[idx] = { ...rulesList.value[idx], title: t }
    msg.value = '标题已更新'
    setTimeout(() => (msg.value = ''), 2000)
  } catch (e) {
    err.value = e.message
  }
}

async function deleteRule() {
  if (!currentRule.value) return
  if (!window.confirm(`确定删除规则「${currentRule.value.title}」？删除后不可恢复。`)) return
  err.value = ''
  try {
    const id = currentRule.value.id
    await apiDeleteRule(id)
    await tournament.fetchCurrent()
    rulesList.value = [...(tournament.current.rules || [])]
    currentRuleId.value = rulesList.value.length ? String(rulesList.value[0].id) : null
    applyRuleToEditor()
    msg.value = '规则已删除'
    setTimeout(() => (msg.value = ''), 2000)
  } catch (e) {
    err.value = e.message
  }
}

async function saveBackground(value) {
  background.value = value
  await save()
}

async function onUploadBanner(e) {
  const file = e.target.files[0]
  if (!file) return
  err.value = ''
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', 'banner')
    await uploadDataFile(fd)
    await tournament.fetchCurrent()
    msg.value = '横幅已上传（点击可设为图片背景）'
    setTimeout(() => (msg.value = ''), 2500)
  } catch (e) {
    err.value = e.message
  }
  e.target.value = ''
}

async function deleteBanner(b) {
  err.value = ''
  if (!window.confirm('确定删除该横幅/背景图？')) return
  try {
    await deleteUpload(b.id)
    const wasBackground = background.value === b.path
    if (wasBackground) background.value = ''
    await save()
    if (!wasBackground) await tournament.fetchCurrent()
    msg.value = '横幅已删除'
    setTimeout(() => (msg.value = ''), 2500)
  } catch (e) {
    err.value = e.message
  }
}

async function clearBackground() {
  background.value = ''
  await save()
  msg.value = '背景已清除'
  setTimeout(() => (msg.value = ''), 2500)
}

async function switchTournament(e) {
  await tournament.setCurrent(Number(e.target.value))
  syncFromCurrent()
}

onMounted(async () => {
  try {
    await tournament.load(true)
    syncFromCurrent()
  } catch (e) {
    err.value = e.message
  }
  loading.value = false
})

watch(
  () => tournament.current?.id,
  (nid, oid) => {
    if (nid && nid !== oid && tournament.loaded) syncFromCurrent()
  }
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div class="container rules-edit-page">
    <div class="page-head">
      <div>
        <h2>规则管理</h2>
        <span class="text-muted">为所选赛事编辑标题、正文（支持字号与报名表按钮）与页面背景</span>
      </div>
      <div class="head-right">
        <span v-if="msg" class="success">{{ msg }}</span>
        <span v-if="err" class="error">{{ err }}</span>
        <span v-if="imgError" class="error">{{ imgError }}</span>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else>
      <div class="card base-config">
        <label class="field">
          <span>当前赛事</span>
          <select class="form-control" :value="tournament.currentId" @change="switchTournament">
            <option v-for="t in tournament.list" :key="t.id" :value="t.id">{{ t.name }} ({{ t.code }})</option>
          </select>
        </label>
        <div class="field-row">
          <label class="field grow">
            <span>赛事名称</span>
            <input v-model.trim="name" class="form-control" placeholder="赛事标题" />
          </label>
          <label class="field grow">
            <span>赛事介绍</span>
            <input v-model.trim="description" class="form-control" placeholder="规则页副标题" />
          </label>
        </div>
        <label class="field">
          <span>顶部报名表按钮链接（留空则不显示顶部按钮）</span>
          <input v-model.trim="registrationUrl" class="form-control" placeholder="https://..." />
        </label>
      </div>

      <div class="card rules-manage-card">
        <div class="rules-manage-head">
          <h3>规则管理 <span class="text-muted">（本赛事下可建多份规则，分别编辑）</span></h3>
          <div class="rules-manage-actions">
            <button class="btn btn-sm btn-primary" @click="createRule">＋ 新建规则</button>
            <button class="btn btn-sm" @click="renameRule" :disabled="!currentRule">改名</button>
            <button class="btn btn-sm btn-danger" @click="deleteRule" :disabled="!currentRule">删除</button>
          </div>
        </div>
        <div class="rules-tabs">
          <button
            v-for="r in rulesList"
            :key="r.id"
            class="rules-tab"
            :class="{ active: String(currentRuleId) === String(r.id) }"
            @click="switchRule(r.id)"
          >{{ r.title }}</button>
          <span v-if="!rulesList.length" class="text-muted">暂无规则，点击「新建规则」创建</span>
        </div>
        <div v-if="currentRule" class="rule-registration">
          <span class="bg-label">「{{ currentRule.title }}」报名链接：</span>
          <input v-model="ruleRegUrl" class="form-control reg-input" placeholder="https://...（留空则用赛事级报名链接）" />
          <button class="btn btn-sm" @click="saveRuleRegUrl">保存链接</button>
        </div>
      </div>

      <div class="editor-wrap card">
        <div class="bg-config">
          <span class="bg-label">正文背景</span>
          <button
            v-for="p in contentBgPresets"
            :key="p.value"
            class="bg-preset"
            :class="{ active: contentBg === p.value }"
            @click="contentBg = p.value; save()"
          >
            <span class="swatch" :class="{ transparent: !p.value }" :style="p.value ? { background: p.value } : {}"></span>
            {{ p.label }}
          </button>
          <input type="color" :value="bgColorVal" class="color-input" title="自定义正文背景色"
            @input="contentBg = $event.target.value; save()" />
        </div>

        <div class="bg-config">
          <span class="bg-label">页面背景</span>
          <div class="bg-current" :title="background">
            <span class="current-dot" :style="backgroundDot"></span>
            <span>{{ currentBgLabel }}</span>
          </div>
          <button
            v-for="p in bgPresets"
            :key="p.value"
            class="bg-preset"
            :class="{ active: background === p.value }"
            @click="saveBackground(p.value)"
          >
            <span class="swatch" :class="{ transparent: !p.value }" :style="p.value ? { background: p.value } : {}"></span>
            {{ p.label }}
          </button>
          <input type="color" :value="bgColorVal" class="color-input" title="自定义背景色"
            @input="saveBackground($event.target.value)" />
        </div>

        <div class="banner-config">
          <span class="bg-label">横幅（显示在规则页标题下方，点击横幅即作为图片背景）：</span>
          <div v-for="b in banners" :key="b.id" class="bg-thumb"
            :class="{ active: background === b.path }" :title="background === b.path ? '当前背景 · 点击取消' : '用作背景'"
            @click="background === b.path ? clearBackground() : saveBackground(b.path)">
            <img :src="b.path" :alt="b.original_name" />
            <button class="bg-delete" title="删除该横幅" @click.stop="deleteBanner(b)">✕</button>
          </div>
          <label class="btn btn-sm upload-bg-btn">
            上传横幅
            <input type="file" accept="image/*" class="hidden-input" @change="onUploadBanner" />
          </label>
          <span v-if="!banners.length" class="text-muted">暂无横幅，可点击「上传横幅」上传</span>
        </div>

        <div v-if="editor" class="editor-toolbar">
          <button class="tool-btn" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()" title="加粗"><b>B</b></button>
          <button class="tool-btn" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()" title="斜体"><i>I</i></button>
          <button class="tool-btn" :class="{ active: editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()" title="下划线"><u>U</u></button>
          <button class="tool-btn" :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()" title="删除线"><s>S</s></button>
          <span class="tool-sep"></span>
          <select class="tool-select" :value="currentFontSize" @change="applyFontSize" title="字号">
            <option value="">默认</option>
            <option v-for="s in fontSizes" :key="s" :value="s">{{ s }}px</option>
          </select>
          <select class="tool-select" @change="editor.chain().focus().setTextAlign($event.target.value).run()" title="对齐">
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
          </select>
          <span class="tool-sep"></span>
          <select class="tool-select" :value="currentTextColor" @change="applyTextColor" title="文字颜色">
            <option value="">颜色：默认</option>
            <option value="transparent">颜色：透明</option>
            <option v-if="currentTextColor && currentTextColor !== 'transparent'" :value="currentTextColor">{{ currentTextColor }}</option>
          </select>
          <input type="color" :value="colorVal" class="color-input" title="自定义文字颜色" @input="applyColor" />
          <select class="tool-select" :value="currentHighlight" @change="applyHighlight" title="文字背景颜色">
            <option value="">高亮：无</option>
            <option value="transparent">高亮：透明</option>
            <option v-if="currentHighlight && currentHighlight !== 'transparent'" :value="currentHighlight">{{ currentHighlight }}</option>
          </select>
          <input type="color" :value="bgColorVal" class="color-input" title="自定义文字背景颜色" @input="applyBgColor" />
          <span class="tool-sep"></span>
          <select class="tool-select" :value="editor.getAttributes('heading').level || 0"
            @change="editor.chain().focus().setParagraph().run(); editor.chain().focus().toggleHeading({ level: Number($event.target.value) || undefined }).run()">
            <option :value="0">正文</option>
            <option :value="1">H1</option>
            <option :value="2">H2</option>
            <option :value="3">H3</option>
          </select>
          <button class="tool-btn" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()">• 列表</button>
          <button class="tool-btn" :class="{ active: editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()">1. 列表</button>
          <button class="tool-btn" :class="{ active: editor.isActive('blockquote') }" @click="editor.chain().focus().toggleBlockquote().run()">引用</button>
          <span class="tool-sep"></span>
          <button class="tool-btn" :class="{ active: editor.isActive('table') }" @click="insertTable" title="插入表格（光标在单元格内时插入即为内嵌表格）">表格</button>
          <template v-if="editor.isActive('table')">
            <button class="tool-btn" @click="insertNestedTable" title="在当前单元格内插入内嵌表格">⤵内嵌</button>
            <button class="tool-btn" @click="editor.chain().focus().addRowBefore().run()" title="上方加行">⬆行</button>
            <button class="tool-btn" @click="editor.chain().focus().addRowAfter().run()" title="下方加行">⬇行</button>
            <button class="tool-btn" @click="editor.chain().focus().deleteRow().run()" title="删除行">✕行</button>
            <button class="tool-btn" @click="editor.chain().focus().addColumnBefore().run()" title="左侧加列">⬅列</button>
            <button class="tool-btn" @click="editor.chain().focus().addColumnAfter().run()" title="右侧加列">➡列</button>
            <button class="tool-btn" @click="editor.chain().focus().deleteColumn().run()" title="删除列">✕列</button>
            <button class="tool-btn" @click="editor.chain().focus().toggleHeaderRow().run()" title="切换表头行">表头</button>
            <button class="tool-btn" @click="editor.chain().focus().deleteTable().run()" title="删除表格">✕表格</button>
          </template>
          <span class="tool-sep"></span>
          <button class="tool-btn" :class="{ active: editor.isActive('image') }" @click="pickImage" title="插入图片（上传后嵌入正文，可调宽度）" :disabled="uploadingImage">{{ uploadingImage ? '上传中...' : '🖼 图片' }}</button>
          <input ref="imageInput" type="file" accept="image/*" class="hidden-input" @change="onInsertImage" />
          <template v-if="editor.isActive('image')">
            <select class="tool-select" :value="currentImageWidth" @change="applyImageWidth" title="图片宽度">
              <option value="">原尺寸</option>
              <option value="25%">25%</option>
              <option value="50%">50%</option>
              <option value="75%">75%</option>
              <option value="100%">100%</option>
            </select>
            <button class="tool-btn" @click="removeImageOnly" title="从正文移除图片（保留服务器文件）">✕图片</button>
            <button class="tool-btn" @click="removeImageFile" title="从正文移除并删除服务器文件">🗑文件</button>
          </template>
          <button class="tool-btn" :class="{ active: editor.isActive('link') }" @click="setLink">链接</button>
          <button class="tool-btn btn-register-tool" @click="insertRegisterButton">＋ 报名表按钮</button>
          <button class="tool-btn" @click="editor.chain().focus().unsetAllMarks().clearNodes().run()">清除</button>
        </div>

        <div class="editor-body">
          <EditorContent :editor="editor" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rules-edit-page {
  padding-top: 18px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.page-head h2 {
  background: linear-gradient(90deg, #e0f2fe, var(--accent), #c4b5fd);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 4px;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.success { color: var(--green); }
.error { color: var(--red); }

.base-config {
  padding: 18px;
  margin-bottom: 16px;
}

.rules-manage-card {
  padding: 16px 18px;
  margin-bottom: 16px;
}

.rules-manage-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.rules-manage-head h3 {
  font-size: 15px;
}

.rules-manage-actions {
  display: flex;
  gap: 8px;
}

.rules-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.rules-tab {
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-elev);
  color: var(--text-sub);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.rules-tab:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.rules-tab.active {
  background: var(--accent-grad);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.35);
}

.rule-registration {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.reg-input {
  flex: 1;
  max-width: 420px;
}

.field {
  display: block;
  margin-bottom: 12px;
}

.field.grow {
  flex: 1;
  margin-bottom: 0;
}

.field span {
  display: block;
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 6px;
}

.field-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.editor-wrap {
  padding: 16px;
}

.bg-config {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 10px;
}

.bg-label {
  font-size: 13px;
  color: var(--text-sub);
}

.bg-current {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-elev);
  color: var(--text-main);
  font-size: 12px;
  max-width: 260px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.current-dot {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.banner-config {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 10px;
}

.bg-thumb {
  width: 90px;
  height: 54px;
  border: 2px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}

.bg-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.bg-delete {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.bg-thumb:hover .bg-delete {
  opacity: 1;
}

.bg-delete:hover {
  background: var(--red);
}

.bg-thumb:hover {
  border-color: var(--accent);
}

.bg-thumb.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.3), 0 0 12px rgba(56, 189, 248, 0.25);
}

.upload-bg-btn {
  position: relative;
}

.hidden-input {
  display: none;
}

.bg-preset {
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 12px;
  background: var(--bg-elev);
  color: var(--text-main);
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.swatch.transparent {
  background: repeating-conic-gradient(#ffffff 0% 25%, #cbd5e1 0% 50%) 0 0 / 10px 10px;
}

.bg-preset:hover {
  border-color: var(--accent);
}

.bg-preset.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25), 0 0 12px rgba(56, 189, 248, 0.25);
}

.color-input {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 2px;
  cursor: pointer;
  background: var(--bg-input);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  padding: 8px;
  background: rgba(148, 163, 184, 0.06);
  border: 1px solid var(--border);
  border-radius: 10px 10px 0 0;
}

.tool-btn {
  min-width: 32px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid transparent;
  background: none;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-main);
  transition: all 0.15s;
}

.tool-btn:hover {
  background: rgba(148, 163, 184, 0.15);
}

.tool-btn.active {
  background: rgba(56, 189, 248, 0.16);
  color: var(--accent);
  border-color: rgba(56, 189, 248, 0.35);
}

.btn-register-tool {
  color: var(--accent);
  border-color: rgba(56, 189, 248, 0.4);
}

.tool-select {
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-card-solid);
  color: var(--text-main);
  font-size: 12px;
  padding: 0 4px;
}

.tool-sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 4px;
}

.editor-body {
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 10px 10px;
  background: var(--bg-input);
  min-height: 500px;
  padding: 16px;
}

.editor-body :deep(.rules-editor-content) {
  min-height: 460px;
  outline: none;
  font-size: 16px;
  line-height: 1.9;
  color: var(--text-main);
}

.editor-body :deep(.rules-editor-content h1) { font-size: 28px; margin: 24px 0 16px; color: var(--text-main); }
.editor-body :deep(.rules-editor-content h2) { font-size: 24px; margin: 22px 0 14px; color: var(--text-main); }
.editor-body :deep(.rules-editor-content h3) { font-size: 20px; margin: 20px 0 12px; color: var(--text-main); }
.editor-body :deep(.rules-editor-content p) { margin: 10px 0; }
.editor-body :deep(.rules-editor-content ul),
.editor-body :deep(.rules-editor-content ol) { margin: 10px 0; padding-left: 26px; }
.editor-body :deep(.rules-editor-content blockquote) {
  border-left: 4px solid var(--accent);
  background: rgba(56, 189, 248, 0.08);
  padding: 10px 14px;
  margin: 12px 0;
}
.editor-body :deep(.rules-editor-content a) { color: var(--accent); text-decoration: underline; }
.editor-body :deep(.rules-editor-content table) {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  margin: 12px 0;
  overflow: hidden;
  border-radius: 8px;
}
.editor-body :deep(.rules-editor-content th),
.editor-body :deep(.rules-editor-content td) {
  border: 1px solid var(--border);
  padding: 8px 10px;
  vertical-align: top;
  min-width: 60px;
  position: relative;
  color: var(--text-main);
}
.editor-body :deep(.rules-editor-content th) {
  background: rgba(56, 189, 248, 0.12);
  font-weight: 700;
}
.editor-body :deep(.rules-editor-content .selectedCell) {
  background: rgba(56, 189, 248, 0.18);
}
.editor-body :deep(.rules-editor-content .column-resize-handle) {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: -2px;
  width: 4px;
  background: var(--accent);
  pointer-events: none;
}
.editor-body :deep(.rules-editor-content .btn-register) {
  display: inline-block;
  margin: 8px 4px;
  padding: 8px 22px;
  border-radius: 999px;
  background: var(--accent-grad);
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(56, 189, 248, 0.35);
}
.editor-body :deep(.rules-editor-content img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  display: block;
  margin: 8px 0;
}
.editor-body :deep(.rules-editor-content img.ProseMirror-selectednode) {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
.editor-body :deep(.rules-editor-content .selectedCell:has(img)) {
  background: transparent;
}

:root[data-theme="dark"] .editor-body :deep(.rules-editor-content span[style*="color"]),
:root[data-theme="dark"] .editor-body :deep(.rules-editor-content p[style*="color"]),
:root[data-theme="dark"] .editor-body :deep(.rules-editor-content h1[style*="color"]),
:root[data-theme="dark"] .editor-body :deep(.rules-editor-content h2[style*="color"]),
:root[data-theme="dark"] .editor-body :deep(.rules-editor-content h3[style*="color"]),
:root[data-theme="dark"] .editor-body :deep(.rules-editor-content li[style*="color"]) {
  color: var(--text-main) !important;
}
</style>