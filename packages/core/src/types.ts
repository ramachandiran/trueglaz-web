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
  /** The QC-passed condition report. Null while nothing has been signed off. */
  inspectionReport: RenderedReport | null
  priceHistory: ListingPriceChange[]
}

export interface ConsignmentItem {
  id: string
  submissionId: string
  sellerUserId: string
  productModelId: string | null
  modelFreeText: string | null
  categoryId: string | null
  brandId: string | null
  description: string | null
  reasonToSell: string | null
  underWarranty: boolean | null
  hasBill: boolean
  hasBox: boolean
  /** The original box still has its accessories in it. Implies hasBox. */
  hasAccessories: boolean
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
  consignmentItemId: string
  checklistTemplateId: string
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

export interface Session {
  token: string
  expiresAt: string
  userId: string
  displayName: string
  email: string | null
  roles: string[]
}

export interface Submission {
  id: string
  sellerUserId: string
  state: string
  pricingMode: string
  shipBy: string | null
  submittedAt: string | null
  preApprovedAt: string | null
  rejectedReasonCode: string | null
  expiresAt: string | null
  createdAt: string
}

export interface SubmissionView {
  submission: Submission
  items: ConsignmentItem[]
}

export interface InboundShipment {
  id: string
  submissionId: string
  courierCode: string
  trackingNumber: string
  state: string
  shippedAt: string | null
  deliveredAt: string | null
}

export interface Intake {
  id: string
  inboundShipmentId: string
  receivedBy: string | null
  hasDiscrepancy: boolean
  notes: string | null
}

export interface StorageBin {
  id: string
  code: string
  zone: string | null
  isActive: boolean
}

export interface ChecklistTemplate {
  id: string
  categoryId: string | null
  version: number
  status: string
  name: string
}

export interface ChecklistItem {
  id: string
  checklistTemplateId: string
  /** Grouping shown as a heading: Optics, Mechanics, Cosmetics, … */
  section: string
  code: string
  /** The question itself. The column is `label`, not `prompt`. */
  label: string
  /** boolean | enum | numeric | text — `enum`, not `option`. */
  answerType: string
  options: string[] | null
  /** e.g. "actuations" for a shutter count; shown beside the input. */
  unit: string | null
  isMandatory: boolean
  affectsGrade: boolean
  /** For a yes/no question, the answer that means nothing is wrong. */
  desirableBoolean: boolean | null
  displayOrder: number
}

export interface InspectionAnswer {
  id: string
  inspectionReportId: string
  checklistItemId: string
  valueBoolean: boolean | null
  valueNumeric: number | null
  valueText: string | null
  valueOption: string | null
}

export interface Reservation {
  id: string
  listingId: string
  consignmentItemId: string
  userId: string
  expiresAt: string
  releasedAt: string | null
  orderId: string | null
}

export interface Order {
  id: string
  orderNumber: string
  buyerUserId: string
  state: string
  subtotalMinor: number
  shippingMinor: number
  taxMinor: number
  discountMinor: number
  totalMinor: number
  deliveryAddress: Record<string, unknown> | null
  completedAt: string | null
  createdAt: string
}

export interface OrderLine {
  id: string
  orderId: string
  consignmentItemId: string
  listingId: string
  sellerUserId: string
  itemPriceMinor: number
  gradeCodeAtSale: string
  feeSnapshotId: string
  state: string
  acceptanceWindowEndsAt: string | null
  acceptedAt: string | null
  acceptedBy: string | null
}

export interface Payment {
  id: string
  orderId: string
  gateway: string
  gatewayRef: string
  method: string | null
  amountMinor: number
  state: string
  capturedAt: string | null
}

export interface OrderDetail {
  order: Order
  lines: OrderLine[]
  payments: Payment[]
}

export interface Payout {
  id: string
  sellerUserId: string
  orderLineId: string
  payoutAccountId: string | null
  grossMinor: number
  taxWithheldMinor: number
  netMinor: number
  state: string
  holdReasonCode: string | null
  approvedAt: string | null
  paidAt: string | null
  transferRef: string | null
}

/**
 * Where a seller's money goes.
 *
 * Only the last four digits of an account number are ever sent — the API does
 * not keep the rest, which is the point rather than an omission.
 */
export interface PayoutAccountView {
  method: string
  accountHolderName: string
  accountLast4: string | null
  ifsc: string | null
  upiVpa: string | null
  verificationState: string
  verifiedAt: string | null
  createdAt: string | null
}

export interface PriceProposal {
  id: string
  consignmentItemId: string
  gradeCode: string
  computedAmountMinor: number
  computedInputs: Record<string, unknown> | null
  staffAmountMinor: number | null
  staffOverrideReason: string | null
  finalAmountMinor: number
  createdAt: string
}

export interface FeeSnapshot {
  id: string
  consignmentItemId: string
  salePriceMinor: number
  commissionMinor: number
  expectedNetMinor: number
  capturedAt: string
}

export interface FeeRule {
  id: string
  feeType: string
  bandMinMinor: number
  bandMaxMinor: number | null
  percent: number | null
  flatMinor: number | null
}

export interface FeeQuote {
  salePriceMinor: number
  commissionMinor: number
  expectedNetMinor: number
  rulesApplied: Array<Record<string, unknown>>
}

export interface SellerApproval {
  id: string
  consignmentItemId: string
  priceProposalId: string
  feeSnapshotId: string
  requiredReason: string
  decision: string
  counterAmountMinor: number | null
  counterRound: number
  expiresAt: string
  decidedAt: string | null
}

export interface SellerApprovalView {
  approval: SellerApproval
  requiredBecause: string
  declaredGradeCode: string
  assignedGradeCode: string | null
  askingAmountMinor: number
  floorAmountMinor: number | null
  proposedAmountMinor: number
  commissionMinor: number
  expectedNetMinor: number
}

export interface ProposalOutcome {
  proposal: PriceProposal
  feeSnapshotId: string | null
  sellerApproval: SellerApproval | null
  listing: Listing | null
}

export interface LedgerAccountBalance {
  code: string
  type: string
  ownerUserId: string | null
  balanceMinor: number
}

export interface LedgerTransactionView {
  transaction: {
    id: string
    kind: string
    referenceType: string
    referenceId: string
    description: string
    createdAt?: string
  }
  entries: Array<{ accountCode: string; direction: string; amountMinor: number }>
}

export interface Reconciliation {
  gateway_clearing: number
  bank: number
  escrow_liability_held: number
  seller_payable_total: number
  commission_revenue: number
  shipping_revenue: number
  payment_processing_expense: number
}

export interface PlatformSetting {
  key: string
  value: string
  valueType: string
  description: string
}

export interface KycStatus {
  status: 'not_started' | 'in_review' | 'verified' | 'rejected' | 'expired' | string
  canSell: boolean
  legalName: string | null
  idType: string | null
  idLast4: string | null
  gstin: string | null
  submittedAt: string | null
  verifiedAt: string | null
  expiresAt: string | null
  rejectedReasonCode: string | null
}

export interface KycReview {
  userId: string
  displayName: string
  email: string | null
  status: string
  legalName: string | null
  idType: string | null
  idLast4: string | null
  gstin: string | null
  submittedAt: string | null
  rejectedReasonCode: string | null
}

export interface ActorHint {
  userId: string
  displayName: string
  email: string | null
  suggestedRoleHeader: string
  useFor: string
}

/**
 * One recorded checklist answer, already joined to the question it answers.
 *
 * The API does the join because an answer row on its own carries a
 * checklist_item_id and a typed value column — correct storage, unreadable
 * screen. `displayValue` is the rendered one; the raw columns are there for
 * anything that needs to compute rather than print.
 */
export interface ReportAnswer {
  code: string
  section: string
  label: string
  answerType: string
  unit: string | null
  affectsGrade: boolean
  /** For a yes/no question, the answer that means nothing is wrong. */
  desirableBoolean: boolean | null
  displayOrder: number
  displayValue: string | null
  valueBoolean: boolean | null
  valueNumeric: number | null
  valueText: string | null
  valueOption: string | null
  answeredAt: string | null
}

export interface ReportSection {
  section: string
  answers: ReportAnswer[]
}

export interface RenderedReport {
  reportId: string
  purpose: string
  qcState: string
  outcome: string | null
  suggestedGradeCode: string | null
  proposedGradeCode: string | null
  finalGradeCode: string | null
  verifiedShutterCount: number | null
  startedAt: string | null
  submittedAt: string | null
  qcAt: string | null
  templateVersion: number | null
  answeredCount: number
  questionCount: number
  sections: ReportSection[]
}

export interface ReasonCode {
  code: string
  domain: string
  label: string
  isActive: boolean
  displayOrder: number
}

export interface Profile {
  userId: string
  displayName: string
  email: string | null
  phone: string | null
  roles: string[]
  accountState: string
  memberSince: string | null
  sellerActivatedAt: string | null
  kycStatus: string
  canSell: boolean
  payoutAccount: PayoutAccountView | null
  addressCount: number
}

export interface Address {
  id: string
  userId: string
  label: string | null
  recipientName: string
  line1: string
  line2: string | null
  city: string
  state: string
  pincode: string
  countryCode: string | null
  phoneE164: string | null
  isDefault: boolean
}

/** A one-time code was sent somewhere. `devCode` only exists on a dev server. */
export interface CodeSent {
  sent: boolean
  contact: string
  expiresAt: string
  devCode: string | null
}

export interface SessionInfo {
  id: string
  current: boolean
  userAgent: string | null
  ipAddress: string | null
  signedInAt: string | null
  lastSeenAt: string | null
  expiresAt: string
}

/** A published want. Carries the thing, never the person who wants it. */
export interface WantedRequest {
  id: string
  wanted: string
  productModelId: string | null
  minGradeCode: string | null
  minGradeLabel: string | null
  maxPriceMinor: number | null
  note: string | null
  /** When the buyer asked. A date is not identity; who asked is never sent. */
  createdAt: string | null
  publishedAt: string | null
}

export interface MyRequest {
  id: string
  wanted: string
  state: 'submitted' | 'published' | 'rejected' | 'withdrawn' | 'fulfilled' | string
  minGradeCode: string | null
  minGradeLabel: string | null
  maxPriceMinor: number | null
  note: string | null
  rejectedReasonCode: string | null
  createdAt: string | null
  publishedAt: string | null
}

export interface MyRequests {
  limit: number
  openCount: number
  slotsLeft: number
  requests: MyRequest[]
}

export interface ReviewRequest {
  id: string
  wanted: string
  state: string
  fromCatalogue: boolean
  minGradeCode: string | null
  maxPriceMinor: number | null
  note: string | null
  rejectedReasonCode: string | null
  createdAt: string | null
}
