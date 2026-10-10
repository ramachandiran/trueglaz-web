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
  /** For the stock-image fallback. Null when the unit matched no model. */
  modelSlug: string | null
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
  /** Who is MEANT to inspect it. Who did is on the inspection report. */
  assignedTechnicianUserId: string | null
  assignedByUserId: string | null
  assignedAt: string | null
  listedAt: string | null
  soldAt: string | null
  returnedAt: string | null
  createdAt: string
  updatedAt: string
}

/** A name on the bench roster, for the picker. Not a directory entry. */
export interface Technician {
  id: string
  displayName: string
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
  /** Wants prose as well as a code. Every reversal does. */
  requiresNote: boolean
  /** Undoing rather than progressing, so the UI can say so before the click. */
  isReversal: boolean
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

/** A lens mount — what decides whether a lens will physically fit a body. */
export interface Mount {
  id: string
  name: string
  brandId: string | null
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
  sensorFormat: string | null
  focalLengthMinMm: number | null
  focalLengthMaxMm: number | null
  /** prime | zoom | super_zoom. Null on a body. */
  lensTypeCode: string | null
  /** fisheye … super_telephoto, plus macro and tilt-shift. Null on a body. */
  lensRangeCode: string | null
  msrpMinor: number | null
}

/** A code-and-label list the filters and forms draw from. */
export interface LensType {
  code: string
  label: string
  displayOrder: number
  isActive: boolean
}

export type LensRange = LensType

export interface SensorFormat {
  code: string
  label: string
  /** Against full frame — what turns a focal length into what it frames like. */
  cropFactor: number
  displayOrder: number
  isActive: boolean
}

export interface TransitionRule {
  fromState: string
  toState: string
  allowedRoles: string[]
  requiresReason: boolean
  /** Wants prose as well as a code. Every reversal does. */
  requiresNote: boolean
  /** Undoing rather than progressing, so the UI can say so before the click. */
  isReversal: boolean
  notes: string | null
}

/**
 * What /auth/verify and /auth/sign-up both answer with.
 *
 * One shape for both endings: a session, or "nobody has an account on that
 * contact yet, ask them who they are and call sign-up".
 */
export interface AuthResult {
  token: string | null
  expiresAt: string | null
  user: {
    userId: string
    displayName: string
    email: string | null
    roles: string[]
    sellerActivatedAt: string | null
  } | null
  newUser: boolean
  contact: string | null
}

export interface Session {
  token: string
  expiresAt: string
  userId: string
  displayName: string
  email: string | null
  roles: string[]
  /**
   * When identity cleared and this person became a seller, or null.
   *
   * Set by passing KYC, never self-declared, which is why the app can show a
   * selling side off the back of it without ever asking anyone what they are.
   */
  sellerActivatedAt: string | null
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

/**
 * One order as the orders list draws it.
 *
 * Deliberately not `Order`. That shape knows ids; somebody reading their own
 * orders needs names — what the thing was called, what grade it was, who is
 * carrying it. The API joins all of that server-side so the page is one request
 * instead of two per order plus one for invoices.
 */
export interface OrderSummary {
  id: string
  orderNumber: string
  state: string
  createdAt: string | null
  completedAt: string | null

  subtotalMinor: number
  shippingMinor: number
  taxMinor: number
  discountMinor: number
  totalMinor: number

  shipToName: string | null
  shipToCity: string | null

  paidAt: string | null

  /** Null until the payment is captured and the invoice raised. */
  invoiceId: string | null
  invoiceNumber: string | null

  lines: OrderLineSummary[]
}

export interface OrderLineSummary {
  id: string
  consignmentItemId: string
  listingId: string | null

  title: string
  /** Picks the placeholder artwork while real photographs are not served. */
  categoryName: string | null

  itemPriceMinor: number
  gradeCodeAtSale: string
  gradeLabel: string | null

  state: string

  /**
   * When silence becomes acceptance — the one deadline on this screen with
   * money behind it. After it the sale is final and the seller is paid,
   * whether or not anybody clicked anything.
   */
  acceptanceWindowEndsAt: string | null
  acceptedAt: string | null
  acceptedBy: string | null

  courierCode: string | null
  trackingNumber: string | null
  dispatchedAt: string | null
  deliveredAt: string | null
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
  /** Bounds the server validates against. Absent means unbounded either way. */
  minValue?: string | null
  maxValue?: string | null
  updatedBy?: string | null
  updatedAt?: string | null
}

/** One change to a setting, kept because these numbers decide money. */
export interface SettingChange {
  key: string
  oldValue: string | null
  newValue: string
  changedBy: string | null
  changedAt: string | null
}

export interface KycStatus {
  status: 'not_started' | 'in_review' | 'verified' | 'rejected' | 'expired' | string
  canSell: boolean
  legalName: string | null
  /** `uidai` when the name came from the issuer rather than from typing. */
  nameSource: string | null
  /** Masked mobile a code was sent to, while one is outstanding. */
  ekycMobileHint: string | null
  /** True while an Aadhaar code is waiting to be entered. */
  ekycPending: boolean
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
  /** Zero means there is nothing to review, and the API will refuse to pass it. */
  documentCount: number
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
  /** Drives the header badge, so it costs no extra request. */
  unreadNotifications: number
}

/** What happened to the things you are selling or buying. */
export interface Notification {
  id: string
  category: 'selling' | 'buying' | 'payouts' | 'security' | 'rewards' | string
  title: string
  body: string
  /** Relative, inside the app. Null when there is nowhere useful to go. */
  link: string | null
  at: string | null
  readAt: string | null
}

export interface Notifications {
  unread: number
  items: Notification[]
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
  /** When it drops off the board, two weeks after it went up. */
  expiresAt: string | null
}

export interface MyRequest {
  id: string
  wanted: string
  state: 'submitted' | 'published' | 'rejected' | 'withdrawn' | 'fulfilled' | 'expired' | string
  minGradeCode: string | null
  minGradeLabel: string | null
  maxPriceMinor: number | null
  note: string | null
  rejectedReasonCode: string | null
  createdAt: string | null
  publishedAt: string | null
  expiresAt: string | null
}

export interface MyRequests {
  limit: number
  openCount: number
  slotsLeft: number
  /** How long an ask lasts, so the form can say so before they write it. */
  expiryDays: number
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

/**
 * One unit as the admin sees it: every fact the platform holds about it,
 * flattened onto one row. Nullable almost throughout, because a DRAFT item has
 * no listing, no sale and no bin, and a null says so more honestly than a zero.
 */
export interface InventoryRow {
  id: string
  internalSku: string
  serialNumber: string | null
  currentState: string

  categoryName: string | null
  brandName: string | null
  modelName: string | null
  modelFreeText: string | null
  fromCatalogue: boolean
  description: string | null
  reasonToSell: string | null

  declaredGradeCode: string | null
  assignedGradeCode: string | null
  underWarranty: boolean | null
  hasBill: boolean
  hasBox: boolean
  hasAccessories: boolean

  askingAmountMinor: number | null
  floorAmountMinor: number | null
  declaredValueMinor: number | null
  listingPriceMinor: number | null
  commissionMinor: number | null
  expectedNetMinor: number | null

  sellerUserId: string | null
  sellerName: string | null
  sellerEmail: string | null

  submissionId: string | null
  submissionState: string | null
  pricingMode: string | null
  courierCode: string | null
  trackingNumber: string | null
  shipmentState: string | null

  binCode: string | null
  binZone: string | null
  isQuarantineBin: boolean | null

  inspectionQcState: string | null
  inspectionOutcome: string | null
  technicianName: string | null
  qcName: string | null
  shutterCount: number | null
  defectCount: number
  disclosedDefectCount: number

  listingState: string | null
  listingTitle: string | null

  orderNumber: string | null
  orderState: string | null
  orderLineState: string | null
  buyerUserId: string | null
  buyerName: string | null

  payoutState: string | null
  payoutNetMinor: number | null
  payoutPaidAt: string | null

  consignmentExpiresAt: string | null
  listedAt: string | null
  soldAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** A tax document: what the buyer paid, or what the seller was charged. */
export interface Invoice {
  id: string
  invoiceNumber: string
  kind: 'sale' | 'commission' | string
  state: string
  currency: string | null
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
  orderId: string | null
  consignmentItemId: string | null
  placeOfSupply: string | null
  issuedAt: string | null
  zohoInvoiceId: string | null
  zohoSyncedAt: string | null
  zohoError: string | null
}

export interface InvoiceLine {
  description: string
  hsnSac: string | null
  quantity: number
  unitPriceMinor: number
  amountMinor: number
  taxRatePercent: number
  taxMinor: number
}

export interface InvoiceDetail {
  invoice: Invoice
  partyName: string | null
  lines: InvoiceLine[]
}

/**
 * A sale, as the public may see it: the gear and what it went for, never who
 * bought it. Sold prices are the most useful thing a used-gear buyer can see,
 * and the one thing no listing page can tell them.
 */
/** A stored photograph, and where to fetch each size of it. */
export interface MediaView {
  id: string
  role: string
  width: number | null
  height: number | null
  url: string
  /** Width in pixels to the URL that serves it, ready for a srcset. */
  sizes: Record<number, string>
}

/** Where an Aadhaar code was sent, masked. */
export interface EkycStarted {
  mobileHint: string | null
  /** Development only — a real deployment never echoes the code. */
  devCode: string | null
}

/** One identity document on a KYC check. */
export interface KycDocumentView {
  docType: string
  uploadedAt: string | null
  media: MediaView
}

/** Where to PUT the bytes, and the ticket that seals them afterwards. */
export interface UploadIntent {
  url: string
  method: string
  headers: Record<string, string>
  ticket: string
}

/** A piece of gear for sale, with what it saves against buying new. */
export interface HomeListing {
  id: string
  title: string
  gradeCode: string
  gradeLabel: string | null
  priceMinor: number
  msrpMinor: number | null
  savedMinor: number | null
  savedPct: number | null
  brandName: string | null
  categorySlug: string | null
  publishedAt: string | null
  cover: MediaView | null
  /** For the stock-image fallback. Null when the unit matched no model. */
  modelSlug: string | null
}

/** A way into the catalogue, with how much is behind it. */
export interface HomeFacet {
  name: string
  slug: string | null
  liveCount: number
}

/** What a model has done here: how many went, and what is left. */
export interface HomeModel {
  brandName: string
  modelName: string
  soldCount: number
  liveCount: number
  fromPriceMinor: number | null
}

/** An open ask from the Wanted board. */
export interface HomeWanted {
  id: string
  wanted: string
  minGradeCode: string | null
  maxPriceMinor: number | null
}

/** A sale, as the public may see it: the gear and the price, never the people. */
export interface HomeSale {
  id: string
  title: string
  gradeCode: string
  gradeLabel: string | null
  priceMinor: number
  soldAt: string | null
  categorySlug: string | null
  cover: MediaView | null
}

/** Everything the shop front shows, in one answer. */
export interface HomeView {
  justIn: HomeListing[]
  bestSavings: HomeListing[]
  recentlySold: HomeSale[]
  brands: HomeFacet[]
  mounts: HomeFacet[]
  topModels: HomeModel[]
  wanted: HomeWanted[]
}

export interface SoldListing {
  id: string
  title: string
  gradeCode: string
  gradeLabel: string | null
  priceMinor: number
  soldAt: string | null
}

/**
 * One leg a unit has travelled. Named from the item's point of view, because
 * "to_buyer" only means something if you already know who is speaking.
 */
export interface ShipmentLeg {
  id: string
  direction: 'seller_to_trueglaz' | 'trueglaz_to_buyer' | 'trueglaz_to_seller' | string
  label: string
  courierCode: string
  trackingNumber: string | null
  state: string
  insuredValueMinor: number | null
  dispatchedAt: string | null
  deliveredAt: string | null
  createdAt: string | null
  notes: string | null
}

/** Somebody's own referral code, and what it has earned them. */

/**
 * Somewhere to pay an order.
 *
 * Carries no notion of success. The gateway tells the API whether the payment
 * went through, over a channel this browser is not on.
 */
export interface PaymentSessionView {
  orderId: string
  orderNumber: string
  amountMinor: number
  currency: string
  provider: string
  providerOrderId: string
  token: string | null
  /** The gateway's hosted page. Null for a provider that has none. */
  url: string | null
  expiresAt: string | null
}

/* -- staff: people ---------------------------------------------------------- */

/** One person, as the staff queue shows them. */
export interface StaffUserRow {
  userId: string
  displayName: string
  email: string | null
  phone: string | null
  accountState: string
  kycStatus: string
  /** not_requested | pending_review | approved | rejected */
  sellingState: string
  roles: string[]
  itemsListed: number
  ordersPlaced: number
  joinedAt: string | null
}

/** The identity check, as much of it as staff have any business seeing. */
export interface StaffKycView {
  status: string
  legalName: string | null
  /** `uidai` when the name came from the issuer rather than from typing. */
  nameSource: string | null
  idType: string | null
  /** Last four digits only. The number itself is never kept. */
  idLast4: string | null
  provider: string | null
  verifiedAt: string | null
  expiresAt: string | null
  mobileHint: string | null
}

export interface StaffUserDetail {
  user: StaffUserRow
  kyc: StaffKycView | null
  sellingDecidedBy: string | null
  sellingDecidedAt: string | null
  sellingNote: string | null
  /** Masked. Staff confirm a destination exists; they never read it. */
  payoutAccountHint: string | null
}

export interface StaffSellingRow {
  itemId: string
  title: string
  state: string
  gradeCode: string | null
  askingMinor: number | null
  listedPriceMinor: number | null
  soldPriceMinor: number | null
  submittedAt: string | null
  soldAt: string | null
}

export interface StaffBuyingRow {
  orderId: string
  orderNumber: string
  orderState: string
  lineState: string
  title: string
  gradeCode: string | null
  pricePaidMinor: number
  placedAt: string | null
  acceptedAt: string | null
}

/**
 * What kind of deployment is answering.
 *
 * `paymentsAreReal` is false on the demo environment, where the gateway is a
 * stub that approves everything. Everything else there — grading, consignment,
 * the ledger, the state machine — is genuine; only the money is pretend, and
 * the app has to say so before somebody checks out believing otherwise.
 */
export interface Meta {
  paymentsAreReal: boolean
}

/** One option on the signup form's genre box. */
export interface PhotographyGenre {
  code: string
  label: string
  displayOrder: number
  isActive: boolean
}

/**
 * Everything signup collects, beyond the contact that was proven.
 *
 * `email` and `mobile` are both required, but only the one the code reached is
 * marked verified — the other is a claim, and a claim never signs anybody in.
 */
export interface SignUpDetails {
  firstName: string
  lastName: string
  email: string
  mobile: string
  /** One or more genre codes. People shoot more than one thing. */
  photographyGenres: string[]
}


// -- balance sheet --------------------------------------------------------------

export type CourierKind = 'inbound' | 'outbound' | 'return' | 'other'

/** One bill paid to a courier. A unit can carry many. */
export interface CourierCharge {
  id: string
  itemId: string
  kind: CourierKind
  courierCode: string | null
  trackingNumber: string | null
  amountMinor: number
  /** A plain calendar date, YYYY-MM-DD. Not an instant, so never run it through Date. */
  incurredOn: string
  note: string | null
}

export interface NewCourierCharge {
  kind: CourierKind
  courierCode?: string | null
  trackingNumber?: string | null
  amountMinor: number
  incurredOn: string
  note?: string | null
}

/** A closed item: accepted by the buyer, so the money on it is settled in amount if not in time. */
export interface StatementRow {
  orderLineId: string
  itemId: string
  sku: string
  title: string
  orderNumber: string
  closedAt: string
  sellingMinor: number
  /** Postage the buyer paid. Revenue, set against the courier bills. */
  shippingMinor: number
  /** What the seller is paid. Consigned stock is never bought, so this is the nearest thing to a cost. */
  buyingMinor: number
  payoutState: string | null
  /** GST on the commission. Collected for the government; never profit. */
  gstMinor: number
  courierMinor: number
  charges: CourierCharge[]
  profitMinor: number
}

export interface StatementTotals {
  count: number
  sellingMinor: number
  shippingMinor: number
  buyingMinor: number
  gstMinor: number
  courierMinor: number
  profitMinor: number
}

export interface Statement {
  from: string | null
  to: string | null
  rows: StatementRow[]
  totals: StatementTotals
}

export interface MonthCount {
  /** YYYY-MM */
  month: string
  count: number
}

/** A cancelled order whose payment has not been sent back to the buyer yet. */
export interface RefundDue {
  orderId: string
  orderNumber: string
  buyerUserId: string
  amountMinor: number
  paidAt: string | null
  sku: string | null
}

/** Where an approved payout is to be sent. The account number is shown here and nowhere else. */
export interface PayoutDestination {
  payoutId: string
  netMinor: number
  method: 'bank' | 'upi'
  accountHolderName: string
  upiVpa: string | null
  ifsc: string | null
  accountNumber: string | null
  accountLast4: string | null
}

/** One returned line, from the buyer's request to its resolution. */
export interface ReturnCase {
  id: string
  orderLineId: string
  consignmentItemId: string
  buyerUserId: string
  reasonCode: string
  buyerNote: string | null
  /** requested | approved | declined | received | inspected | refunded | escalated | sale_stands */
  state: string
  requestedAt: string | null
  decisionNote: string | null
  inspection: { serialMatches: boolean; conditionOk: boolean; accessoriesOk: boolean; note: string | null } | null
  resolutionNote: string | null
}

/** A case as the buyer sees it: with where to send the parcel once it is approved. */
export interface ReturnForBuyer {
  case: ReturnCase
  courierCode: string | null
  trackingNumber: string | null
}

export interface ReturnCaseView {
  case: ReturnCase
  orderLineId: string
  orderNumber: string
  itemSku: string
  itemLabel: string
  amountMinor: number
  buyerName: string | null
}

/** What staff see first: stage sizes, what is waiting on them, and what just moved. */
export interface StaffHome {
  pipeline: { key: string; label: string; count: number; tone: string }[]
  totals: { units: number; onSaleCount: number; onSaleValueMinor: number; soldWeekCount: number; soldWeekValueMinor: number }
  today: { received: number; listed: number; sold: number; delivered: number; returns: number }
  last7: { day: string; received: number; listed: number; sold: number }[]
  actions: { key: string; group: string; title: string; hint: string; count: number; href: string; tone: 'urgent' | 'normal' | 'quiet' }[]
  recent: {
    itemId: string; sku: string; title: string; fromState: string | null; toState: string
    actorRole: string | null; at: string | null; grade: string | null; priceMinor: number | null
  }[]
}
