import {
  APP_SCHEMA_VERSION,
  type BurialRecord,
  type FamilyData,
  type FamilyEvent,
  type FamilyEventType,
  type KinshipRelation,
  type Member,
  type NameAlias,
  type TemporalExpression,
  type UncertaintyFlag,
} from '../types/member'
import type { ChildClaim } from '../types/childClaim'
import type { Spouse, SpouseRelation, SpouseStatusFlag } from '../types/spouse'

export const STORAGE_KEY = 'family_tree_app_data'

const EVENT_TYPES: FamilyEventType[] = ['婚', '丧', '嫁', '娶', '生', '卒', '其他']
const UNCERTAINTY_FLAGS: UncertaintyFlag[] = ['missing', 'estimated', 'conflicting', 'unverified']
const NAME_ALIAS_TYPES = ['primary', 'given', 'courtesy', 'art', 'taboo', 'alias', 'other']
const KINSHIP_RELATION_TYPES = [
  'father',
  'mother',
  'spouse',
  'step-parent',
  'adoptive-parent',
  'adopted-child',
  'successor',
  'other',
]
const KINSHIP_RELATION_STATUSES = ['active', 'ended', 'uncertain']
const TEMPORAL_CALENDAR_TYPES = ['gregorian', 'lunar-era', 'ganzhi', 'mixed', 'unknown']
const TEMPORAL_PRECISIONS = ['year', 'month', 'day', 'hour', 'unknown']
const SPOUSE_RELATIONS: SpouseRelation[] = ['配', '继配', '妣', '继妣', '三妣', '四妣', '娶', '其他']
const SPOUSE_STATUS_FLAGS: SpouseStatusFlag[] = ['early-deceased', 'lost-record', 'out-married']
const CHILD_CLAIM_GENDERS = ['男', '女', 'unknown']
const CHILD_CLAIM_STATUSES = ['matched', 'missing', 'ambiguous']
const CHILD_CLAIM_STATUS_FLAGS = ['no-grandchildren', 'unmarried', 'out-married', 'lost-record']

const defaultMembers: Member[] = [
  { id: 1, name: '始祖', parentId: null, motherId: null, gender: '男', birthDate: '', deathDate: '', photoUrl: '', biography: '' },
  { id: 2, name: '长子', parentId: 1, motherId: null, gender: '男', birthDate: '', deathDate: '', photoUrl: '', biography: '' },
  { id: 3, name: '次女', parentId: 1, motherId: null, gender: '女', birthDate: '', deathDate: '', photoUrl: '', biography: '' },
]

const defaultData: FamilyData = {
  schemaVersion: APP_SCHEMA_VERSION,
  members: defaultMembers,
  events: [],
  aliases: [],
  relations: [],
  temporals: [],
  burials: [],
  spouses: [],
  childClaims: [],
  nextId: 4,
  nextEventId: 1,
  nextAliasId: 1,
  nextRelationId: 1,
  nextTemporalId: 1,
  nextBurialId: 1,
  nextSpouseId: 1,
  nextChildClaimId: 1,
}

function cloneDefaultData(): FamilyData {
  return {
    ...defaultData,
    members: defaultData.members.map((member) => ({ ...member })),
    events: [],
    aliases: [],
    relations: [],
    temporals: [],
    burials: [],
    spouses: [],
    childClaims: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function isMember(value: unknown): value is Member {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'number' &&
    typeof value.name === 'string' &&
    (value.parentId === null || value.parentId === undefined || typeof value.parentId === 'number') &&
    (value.motherId === null || value.motherId === undefined || typeof value.motherId === 'number') &&
    (value.gender === '男' || value.gender === '女') &&
    (value.deathDate === undefined || typeof value.deathDate === 'string')
  )
}

function isEvent(value: unknown): value is FamilyEvent {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'number' &&
    (value.memberId === null || typeof value.memberId === 'number') &&
    typeof value.type === 'string' &&
    EVENT_TYPES.includes(value.type as FamilyEventType) &&
    typeof value.title === 'string' &&
    typeof value.date === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isNameAlias(value: unknown): value is NameAlias {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'number' &&
    typeof value.memberId === 'number' &&
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    NAME_ALIAS_TYPES.includes(value.type) &&
    typeof value.isPreferred === 'boolean'
  )
}

function isKinshipRelation(value: unknown): value is KinshipRelation {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'number' &&
    typeof value.fromMemberId === 'number' &&
    typeof value.toMemberId === 'number' &&
    typeof value.type === 'string' &&
    KINSHIP_RELATION_TYPES.includes(value.type) &&
    typeof value.status === 'string' &&
    KINSHIP_RELATION_STATUSES.includes(value.status) &&
    (value.temporalId === null || typeof value.temporalId === 'number')
  )
}

function isTemporalExpression(value: unknown): value is TemporalExpression {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'number' &&
    (value.memberId === null || typeof value.memberId === 'number') &&
    typeof value.label === 'string' &&
    typeof value.rawText === 'string' &&
    typeof value.calendarType === 'string' &&
    TEMPORAL_CALENDAR_TYPES.includes(value.calendarType) &&
    typeof value.precision === 'string' &&
    TEMPORAL_PRECISIONS.includes(value.precision) &&
    typeof value.confidence === 'number'
  )
}

function isBurialRecord(value: unknown): value is BurialRecord {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'number' &&
    typeof value.memberId === 'number' &&
    (value.temporalId === null || typeof value.temporalId === 'number') &&
    typeof value.placeRaw === 'string'
  )
}

function isSpouse(value: unknown): value is Spouse {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'number' &&
    typeof value.husbandId === 'number' &&
    typeof value.surname === 'string' &&
    (value.fullName === null || typeof value.fullName === 'string') &&
    Array.isArray(value.aliases) &&
    typeof value.relationLabel === 'string' &&
    SPOUSE_RELATIONS.includes(value.relationLabel as SpouseRelation) &&
    typeof value.order === 'number'
  )
}

function isChildClaim(value: unknown): value is ChildClaim {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'number' &&
    typeof value.parentId === 'number' &&
    typeof value.claimedName === 'string' &&
    typeof value.ordinalIndex === 'number' &&
    typeof value.gender === 'string' &&
    CHILD_CLAIM_GENDERS.includes(value.gender) &&
    typeof value.isAdoptive === 'boolean' &&
    (value.resolvedMemberId === null || typeof value.resolvedMemberId === 'number') &&
    typeof value.status === 'string' &&
    CHILD_CLAIM_STATUSES.includes(value.status)
  )
}

function normalizeIdRef(value: unknown, memberIds: Set<number>): number | null {
  return typeof value === 'number' && memberIds.has(value) ? value : null
}

function maxNext(current: unknown, ids: number[]): number {
  const maxId = ids.length > 0 ? Math.max(...ids) : 0
  return Math.max(typeof current === 'number' ? current : 1, maxId + 1, 1)
}

function normalizeFamilyDataPayload(parsed: Partial<FamilyData>): FamilyData {
  const rawMembers = Array.isArray(parsed.members) ? parsed.members.filter(isMember) : []
  if (rawMembers.length === 0) {
    return cloneDefaultData()
  }

  const seen = new Set<number>()
  const members = rawMembers
    .filter((member) => {
      if (seen.has(member.id)) return false
      seen.add(member.id)
      return true
    })
    .map((member) => ({
      ...member,
      gender: (member.gender === '女' ? '女' : '男') as Member['gender'],
      birthDate: member.birthDate ?? '',
      deathDate: member.deathDate ?? '',
      photoUrl: member.photoUrl ?? '',
      biography: member.biography ?? '',
      generationLabelRaw: member.generationLabelRaw ?? '',
      generationNumber: member.generationNumber,
      lineageBranch: member.lineageBranch ?? '',
      rawNotes: member.rawNotes ?? '',
      uncertaintyFlags: Array.isArray(member.uncertaintyFlags)
        ? member.uncertaintyFlags.filter((flag) => UNCERTAINTY_FLAGS.includes(flag))
        : [],
    }))
    .sort((a, b) => a.id - b.id)

  const memberIds = new Set(members.map((member) => member.id))
  for (const member of members) {
    member.parentId = normalizeIdRef(member.parentId, memberIds)
    member.motherId = normalizeIdRef(member.motherId, memberIds)
  }

  const events = Array.isArray(parsed.events) ? parsed.events.filter(isEvent) : []
  const aliases = Array.isArray(parsed.aliases) ? parsed.aliases.filter(isNameAlias) : []
  const relations = Array.isArray(parsed.relations) ? parsed.relations.filter(isKinshipRelation) : []
  const temporals = Array.isArray(parsed.temporals) ? parsed.temporals.filter(isTemporalExpression) : []
  const burials = Array.isArray(parsed.burials) ? parsed.burials.filter(isBurialRecord) : []
  const spouses = Array.isArray(parsed.spouses)
    ? parsed.spouses.filter(isSpouse).map((spouse) => ({
        ...spouse,
        aliases: spouse.aliases.filter((alias) => typeof alias === 'string'),
        statusFlags: Array.isArray(spouse.statusFlags)
          ? spouse.statusFlags.filter((flag) => SPOUSE_STATUS_FLAGS.includes(flag))
          : [],
        birthDate: spouse.birthDate ?? '',
        deathDate: spouse.deathDate ?? '',
        burialPlace: spouse.burialPlace ?? '',
        biography: spouse.biography ?? '',
        rawText: spouse.rawText ?? '',
        createdAt: spouse.createdAt ?? new Date().toISOString(),
        updatedAt: spouse.updatedAt ?? new Date().toISOString(),
      }))
    : []
  const childClaims = Array.isArray(parsed.childClaims)
    ? parsed.childClaims.filter(isChildClaim).map((claim) => ({
        ...claim,
        outAdoptedToHint: claim.outAdoptedToHint ?? '',
        statusFlags: Array.isArray(claim.statusFlags)
          ? claim.statusFlags.filter((flag) => CHILD_CLAIM_STATUS_FLAGS.includes(flag))
          : [],
        rawText: claim.rawText ?? '',
      }))
    : []

  return {
    schemaVersion: APP_SCHEMA_VERSION,
    members,
    events,
    aliases,
    relations,
    temporals,
    burials,
    spouses,
    childClaims,
    nextId: maxNext(parsed.nextId, members.map((member) => member.id)),
    nextEventId: maxNext(parsed.nextEventId, events.map((event) => event.id)),
    nextAliasId: maxNext(parsed.nextAliasId, aliases.map((alias) => alias.id)),
    nextRelationId: maxNext(parsed.nextRelationId, relations.map((relation) => relation.id)),
    nextTemporalId: maxNext(parsed.nextTemporalId, temporals.map((temporal) => temporal.id)),
    nextBurialId: maxNext(parsed.nextBurialId, burials.map((burial) => burial.id)),
    nextSpouseId: maxNext(parsed.nextSpouseId, spouses.map((spouse) => spouse.id)),
    nextChildClaimId: maxNext(parsed.nextChildClaimId, childClaims.map((claim) => claim.id)),
  }
}

function loadFamilyDataFromLocalStorage(): FamilyData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return cloneDefaultData()
    }

    const parsed = JSON.parse(raw)
    return isRecord(parsed) ? normalizeFamilyDataPayload(parsed as Partial<FamilyData>) : cloneDefaultData()
  } catch {
    return cloneDefaultData()
  }
}

function saveFamilyDataToLocalStorage(data: FamilyData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeFamilyDataPayload(data)))
}

export async function initializeStorage(): Promise<FamilyData> {
  return loadFamilyDataFromLocalStorage()
}

export async function saveFamilyData(data: FamilyData): Promise<void> {
  saveFamilyDataToLocalStorage(data)
}
