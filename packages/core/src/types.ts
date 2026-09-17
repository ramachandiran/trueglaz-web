/** Types mirroring the TrueGlaz API responses. */

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface Listing {
  id: string
  consignmentItemId: string
  title: string
  slug: string
  descriptionGenerated: string | null
  gradeCode: string
  priceMinor: number
  currency: string
  state: string
  publishedAt: string | null
  unpublishedAt: string | null
  createdAt: string
}

export interface Defect {
  id: string
  title: string
  severity: 'cosmetic' | 'functional' | 'optical' | string
  descriptionPublic: string
  displayOrder: number
  isDisclosed: boolean
}

export interface ListingPriceChange {
  id: string
  oldAmountMinor: number
  newAmountMinor: number
  reason: string
  changedAt: string
}

export interface ListingDetail {
  listing: Listing
  gradeLabel: string | null
  gradeDefinition: string | null
  gradePosition: string | null
  serialNumber: string | null
  internalSku: string
  defects: Defect[]
  priceHistory: ListingPriceChange[]
}

export interface ConsignmentItem {
  id: string
  submissionId: string
  sellerUserId: string
  productModelId: string | null
  modelFreeText: string | null
  serialNumber: string | null
  internalSku: string
  declaredGradeCode: string
  assignedGradeCode: string | null
  askingAmountMinor: number
  floorAmountMinor: number | null
  currentState: string
  listedAt: string | null
  soldAt: string | null
  returnedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ItemStateTransition {
  id: string
  fromState: string | null
  toState: string
  actorUserId: string | null
  actorRole: string | null
  reasonCode: string | null
  note: string | null
  occurredAt: string
}

export interface NextState {
  toState: string
  allowedRoles: string[]
  requiresReason: boolean
  notes: string | null
}

export interface InspectionReport {
  id: string
  purpose: string
  technicianUserId: string | null
  qcUserId: string | null
  qcState: string
  proposedGradeCode: string | null
  suggestedGradeCode: string | null
  finalGradeCode: string | null
  outcome: string | null
  startedAt: string | null
  submittedAt: string | null
  qcAt: string | null
}

export interface ItemDetail {
  item: ConsignmentItem
  currentBinCode: string | null
  history: ItemStateTransition[]
  nextLegalStates: NextState[]
  inspections: InspectionReport[]
  defects: Defect[]
  listings: Listing[]
}

export interface Grade {
  code: string
  label: string
  rank: number
  definitionPublic: string | null
  isActive: boolean
}

export interface Brand {
  id: string
  name: string
  isActive: boolean
}

export interface Category {
  id: string
  name: string
  slug: string
  isActive: boolean
}

export interface ProductModel {
  id: string
  brandId: string | null
  categoryId: string | null
  mountId: string | null
  name: string
  slug: string
  status: string
}

export interface TransitionRule {
  fromState: string
  toState: string
  allowedRoles: string[]
  requiresReason: boolean
  notes: string | null
}

export interface ActorHint {
  userId: string
  displayName: string
  email: string | null
  suggestedRoleHeader: string
  useFor: string
}
