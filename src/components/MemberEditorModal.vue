<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useFamilyStore } from '../stores/familyStore'
import type { Gender, Member, MemberInput } from '../types/member'
import type { SpouseRelation } from '../types/spouse'
import { findSpousesByHusband } from '../services/spouseService'

const props = defineProps<{
  member: Member | null
  members: Member[]
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  deleted: []
  notify: [message: string, type?: 'success' | 'error' | 'info']
}>()

const store = useFamilyStore()
const avatarInputRef = ref<HTMLInputElement | null>(null)
const savingState = ref<'idle' | 'saving' | 'saved'>('idle')
const newFatherName = ref('')
const newMotherName = ref('')
const newSpouseName = ref('')
const newSpouseRelation = ref<SpouseRelation>('配')
const newChildName = ref('')
const newChildGender = ref<Gender>('男')
let saveTimerId: number | null = null
let syncingFromProps = false

const draft = reactive<MemberInput>({
  name: '',
  parentId: null,
  motherId: null,
  gender: '男',
  birthDate: '',
  deathDate: '',
  photoUrl: '',
  biography: '',
  generationLabelRaw: '',
  generationNumber: 0,
  lineageBranch: '',
  rawNotes: '',
  uncertaintyFlags: [],
})

const currentSpouses = computed(() => {
  if (!props.member) {
    return []
  }
  return findSpousesByHusband({ spouses: store.spouses.value }, props.member.id)
})

const parentOptions = computed(() => {
  if (!props.member) {
    return props.members
  }
  return props.members.filter((member) => member.id !== props.member?.id)
})

const fatherName = computed(() => {
  if (!props.member?.parentId) return '未填写'
  return props.members.find((member) => member.id === props.member?.parentId)?.name ?? '未知'
})

const motherName = computed(() => {
  if (!props.member?.motherId) return '未填写'
  return props.members.find((member) => member.id === props.member?.motherId)?.name ?? '未知'
})

function syncDraft(member: Member | null): void {
  syncingFromProps = true
  draft.name = member?.name ?? ''
  draft.parentId = member?.parentId ?? null
  draft.motherId = member?.motherId ?? null
  draft.gender = member?.gender ?? '男'
  draft.birthDate = member?.birthDate ?? ''
  draft.deathDate = member?.deathDate ?? ''
  draft.photoUrl = member?.photoUrl ?? ''
  draft.biography = member?.biography ?? ''
  draft.generationLabelRaw = member?.generationLabelRaw ?? ''
  draft.generationNumber = member?.generationNumber ?? 0
  draft.lineageBranch = member?.lineageBranch ?? ''
  draft.rawNotes = member?.rawNotes ?? ''
  draft.uncertaintyFlags = [...(member?.uncertaintyFlags ?? [])]
  window.setTimeout(() => {
    syncingFromProps = false
  }, 0)
}

function saveDraft(): void {
  if (!props.member || syncingFromProps) {
    return
  }
  if (!draft.name.trim()) {
    savingState.value = 'idle'
    return
  }

  savingState.value = 'saving'
  const result = store.updateMember(props.member.id, { ...draft })
  if (!result.ok) {
    savingState.value = 'idle'
    emit('notify', result.message ?? '保存失败', 'error')
    return
  }

  savingState.value = 'saved'
  window.setTimeout(() => {
    if (savingState.value === 'saved') {
      savingState.value = 'idle'
    }
  }, 1200)
}

function scheduleSave(): void {
  if (saveTimerId !== null) {
    window.clearTimeout(saveTimerId)
  }
  saveTimerId = window.setTimeout(saveDraft, 420)
}

watch(
  () => props.member?.id,
  () => {
    syncDraft(props.member)
  },
  { immediate: true },
)

watch(
  draft,
  () => {
    if (!props.visible || syncingFromProps) {
      return
    }
    scheduleSave()
  },
  { deep: true },
)

function makeMemberInput(name: string, gender: Gender, parentId: number | null, motherId: number | null): MemberInput {
  return {
    name,
    parentId,
    motherId,
    gender,
    birthDate: '',
    deathDate: '',
    photoUrl: '',
    biography: '',
    generationLabelRaw: '',
    generationNumber: 0,
    lineageBranch: '',
    rawNotes: '',
    uncertaintyFlags: [],
  }
}

function addParent(kind: 'father' | 'mother'): void {
  if (!props.member) return
  const childId = props.member.id
  const nameRef = kind === 'father' ? newFatherName : newMotherName
  const name = nameRef.value.trim()
  if (!name) {
    emit('notify', kind === 'father' ? '请输入父亲姓名' : '请输入母亲姓名', 'error')
    return
  }

  const created = store.addMember(makeMemberInput(name, kind === 'father' ? '男' : '女', null, null))
  if (!created.ok || typeof created.id !== 'number') {
    emit('notify', created.message ?? '新增失败', 'error')
    return
  }

  const nextDraft = { ...draft }
  if (kind === 'father') {
    nextDraft.parentId = created.id
    newFatherName.value = ''
  } else {
    nextDraft.motherId = created.id
    newMotherName.value = ''
  }

  const updated = store.updateMember(childId, nextDraft)
  if (!updated.ok) {
    emit('notify', updated.message ?? '关联失败', 'error')
    return
  }
  syncDraft(store.members.value.find((member) => member.id === childId) ?? null)
  store.selectMember(childId)
  emit('notify', kind === 'father' ? '父亲已新增并关联' : '母亲已新增并关联', 'success')
}

function addSpouse(): void {
  if (!props.member) return
  const memberId = props.member.id
  const fullName = newSpouseName.value.trim()
  if (!fullName) {
    emit('notify', '请输入配偶姓名', 'error')
    return
  }

  const result = store.addSpouseToMember({
    husbandId: memberId,
    surname: fullName.charAt(0),
    fullName,
    aliases: [],
    relationLabel: newSpouseRelation.value,
    order: currentSpouses.value.length + 1,
    birthDate: '',
    deathDate: '',
    burialPlace: '',
    biography: '',
    statusFlags: [],
    rawText: fullName,
  })

  if (!result.ok) {
    emit('notify', result.message ?? '新增配偶失败', 'error')
    return
  }
  newSpouseName.value = ''
  newSpouseRelation.value = '配'
  emit('notify', '配偶已新增', 'success')
}

function removeSpouse(id: number): void {
  if (!window.confirm('删除该配偶记录？')) return
  const result = store.removeSpouseFromMember(id)
  if (!result.ok) {
    emit('notify', result.message ?? '删除配偶失败', 'error')
    return
  }
  emit('notify', '配偶已删除', 'success')
}

function addChild(): void {
  if (!props.member) return
  const memberId = props.member.id
  const memberGender = props.member.gender
  const name = newChildName.value.trim()
  if (!name) {
    emit('notify', '请输入子女姓名', 'error')
    return
  }

  const parentId = memberGender === '男' ? memberId : null
  const motherId = memberGender === '女' ? memberId : null
  const result = store.addMember(makeMemberInput(name, newChildGender.value, parentId, motherId))
  if (!result.ok || typeof result.id !== 'number') {
    emit('notify', result.message ?? '新增子女失败', 'error')
    return
  }
  newChildName.value = ''
  newChildGender.value = '男'
  store.selectMember(memberId)
  emit('notify', '子女已新增', 'success')
}

function triggerAvatarUpload(): void {
  avatarInputRef.value?.click()
}

async function handleAvatarUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    emit('notify', '请选择图片文件', 'error')
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    draft.photoUrl = typeof reader.result === 'string' ? reader.result : ''
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function deleteCurrentMember(): void {
  if (!props.member) return
  const confirmed = window.confirm(`确认删除 ${props.member.name} 及其后代吗？`)
  if (!confirmed) return

  const result = store.deleteMember(props.member.id)
  if (!result.ok) {
    emit('notify', result.message ?? '删除失败', 'error')
    return
  }
  emit('notify', result.message ?? '成员已删除', 'success')
  emit('deleted')
}
</script>

<template>
  <Teleport to="body">
    <transition name="modal-fade">
      <div v-if="visible && member" class="member-modal-backdrop" @click.self="emit('close')">
        <section class="member-modal" role="dialog" aria-modal="true" aria-label="编辑成员">
          <header class="member-modal-header">
            <div class="editor-identity">
              <button class="avatar-button" type="button" @click="triggerAvatarUpload">
                <img v-if="draft.photoUrl" :src="draft.photoUrl" alt="成员头像" />
                <span v-else>{{ draft.name.slice(0, 1) || '族' }}</span>
              </button>
              <input ref="avatarInputRef" class="hidden-input" type="file" accept="image/*" @change="handleAvatarUpload" />
              <div>
                <p class="modal-kicker">成员 #{{ member.id }}</p>
                <h2>{{ draft.name || '未命名族人' }}</h2>
                <p class="autosave-state">{{ savingState === 'saving' ? '保存中...' : savingState === 'saved' ? '已保存' : '本地自动保存' }}</p>
              </div>
            </div>
            <button class="modal-close" type="button" aria-label="关闭" @click="emit('close')">×</button>
          </header>

          <div class="member-modal-body">
            <section class="editor-section editor-main-fields">
              <h3>基本信息</h3>
              <div class="editor-grid">
                <label class="field">
                  <span>姓名</span>
                  <input v-model="draft.name" type="text" placeholder="请输入姓名" />
                </label>
                <label class="field">
                  <span>性别</span>
                  <select v-model="draft.gender">
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </label>
                <label class="field">
                  <span>出生年份/日期</span>
                  <input v-model="draft.birthDate" type="text" placeholder="如：1958 或 1958-04-12" />
                </label>
                <label class="field">
                  <span>卒年/逝世日期</span>
                  <input v-model="draft.deathDate" type="text" placeholder="如：2020 或 2020-08-21" />
                </label>
              </div>

              <label class="field">
                <span>简介</span>
                <textarea v-model="draft.biography" rows="4" placeholder="记录人物生平、迁徙、职业或家族记忆"></textarea>
              </label>
            </section>

            <section class="editor-section">
              <h3>父母关系</h3>
              <div class="relation-summary">
                <span>父：{{ fatherName }}</span>
                <span>母：{{ motherName }}</span>
              </div>
              <div class="editor-grid">
                <label class="field">
                  <span>选择父亲</span>
                  <select v-model="draft.parentId">
                    <option :value="null">未填写</option>
                    <option v-for="item in parentOptions" :key="item.id" :value="item.id">
                      {{ item.name }}（#{{ item.id }}）
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span>选择母亲</span>
                  <select v-model="draft.motherId">
                    <option :value="null">未填写</option>
                    <option v-for="item in parentOptions" :key="item.id" :value="item.id">
                      {{ item.name }}（#{{ item.id }}）
                    </option>
                  </select>
                </label>
              </div>
              <div class="quick-add-row">
                <input v-model="newFatherName" type="text" placeholder="新父亲姓名" />
                <button class="btn-ghost" type="button" @click="addParent('father')">新增父亲</button>
                <input v-model="newMotherName" type="text" placeholder="新母亲姓名" />
                <button class="btn-ghost" type="button" @click="addParent('mother')">新增母亲</button>
              </div>
            </section>

            <section class="editor-section">
              <h3>配偶</h3>
              <ul v-if="currentSpouses.length > 0" class="relation-list">
                <li v-for="spouse in currentSpouses" :key="spouse.id">
                  <span>[{{ spouse.relationLabel }}] {{ spouse.fullName || `${spouse.surname}氏` }}</span>
                  <button class="btn-danger btn-sm" type="button" @click="removeSpouse(spouse.id)">删除</button>
                </li>
              </ul>
              <p v-else class="empty-tip">暂无配偶记录。</p>
              <div class="quick-add-row">
                <input v-model="newSpouseName" type="text" placeholder="配偶姓名" />
                <select v-model="newSpouseRelation">
                  <option value="配">配</option>
                  <option value="继配">继配</option>
                  <option value="妣">妣</option>
                  <option value="继妣">继妣</option>
                  <option value="娶">娶</option>
                  <option value="其他">其他</option>
                </select>
                <button class="btn-ghost" type="button" @click="addSpouse">新增配偶</button>
              </div>
            </section>

            <section class="editor-section">
              <h3>子女</h3>
              <div class="quick-add-row">
                <input v-model="newChildName" type="text" placeholder="子女姓名" />
                <select v-model="newChildGender">
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
                <button class="btn-primary" type="button" @click="addChild">新增子女</button>
              </div>
            </section>
          </div>

          <footer class="member-modal-footer">
            <button class="btn-danger" type="button" @click="deleteCurrentMember">删除成员</button>
            <button class="btn-primary" type="button" @click="emit('close')">完成</button>
          </footer>
        </section>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.member-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  padding: 20px;
  background: rgba(42, 40, 31, 0.36);
  display: flex;
  align-items: center;
  justify-content: center;
}

.member-modal {
  width: min(880px, 100%);
  max-height: calc(100vh - 40px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid #d9cbaa;
  border-radius: 14px;
  background: #fffef9;
  box-shadow: 0 24px 80px rgba(69, 49, 26, 0.24);
}

.member-modal-header,
.member-modal-footer {
  padding: 16px 18px;
  background: linear-gradient(120deg, #f6f1e3, #fffef9);
  border-bottom: 1px solid #e1d6bd;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.member-modal-footer {
  border-top: 1px solid #e1d6bd;
  border-bottom: none;
  justify-content: flex-end;
}

.editor-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.avatar-button {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px solid #d7c59f;
  background: #f6efe0;
  color: #2d5e2c;
  font-size: 28px;
  font-weight: 700;
  display: grid;
  place-items: center;
  overflow: hidden;
  cursor: pointer;
}

.avatar-button img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.modal-kicker,
.autosave-state {
  margin: 0;
  font-size: 12px;
  color: #746b59;
}

.member-modal h2 {
  margin: 4px 0;
  color: #294d24;
}

.modal-close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid #d2c4a8;
  background: #fffaf0;
  color: #5b513f;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.member-modal-body {
  padding: 16px 18px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor-section {
  border: 1px solid #e0d5bd;
  border-radius: 10px;
  background: #fffdf8;
  padding: 12px;
}

.editor-section h3 {
  margin: 0 0 10px;
  color: #315933;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.relation-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.relation-summary span {
  border: 1px solid #d7c8aa;
  border-radius: 999px;
  background: #f7f1e4;
  padding: 5px 10px;
  font-size: 13px;
  color: #554936;
}

.quick-add-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.quick-add-row input,
.quick-add-row select {
  min-width: 0;
  border: 1px solid #ccbfa1;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fffdf8;
}

.relation-list {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.relation-list li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  border: 1px solid #e0d5bd;
  border-radius: 8px;
  padding: 7px 8px;
  background: #fffaf1;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@media (max-width: 760px) {
  .member-modal-backdrop {
    padding: 10px;
  }

  .member-modal {
    max-height: calc(100vh - 20px);
  }

  .editor-grid,
  .quick-add-row {
    grid-template-columns: 1fr;
  }
}
</style>
