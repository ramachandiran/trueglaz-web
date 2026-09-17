import { getStorage } from './storage'
import type {
  ActorHint, Brand, Category, ChecklistItem, ChecklistTemplate, ConsignmentItem, Defect,
  FeeQuote, FeeRule, FeeSnapshot, Grade, InboundShipment, InspectionAnswer, InspectionReport,
  Intake, ItemDetail, LedgerAccountBalance, LedgerTransactionView, Listing, ListingDetail,
  KycReview, KycStatus, Order, OrderDetail, OrderLine, Page, Payment, Payout, PayoutAccount, PlatformSetting,
  PriceProposal, ProductModel, ProposalOutcome, ReasonCode, Reconciliation, RenderedReport, Reservation, SellerApproval,
  SellerApprovalView, Session, StorageBin, Submission, SubmissionView, TransitionRule,
} from './types'

/**
 * Identity is a bearer token issued by the API's OTP flow.
 *
 * The roles that come back are used only to decide what to SHOW. Every call is
 * enforced server-side against `user_role`, because a browser cannot be trusted
 * to police itself — hiding a button is a courtesy, not a control.
 */
const SESSION_KEY = 'trueglaz.session'

let session: Session | null = null
let onExpired: (() => void) | null = null

export const currentSession = (): Session | null => session

/** Called when the API rejects the token, so the app can send the user to sign in. */
export function onSessionExpired(handler: () => void) {
  onExpired = handler
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await getStorage().get(SESSION_KEY)
    session = raw ? (JSON.parse(raw) as Session) : null
  } catch {
    session = null
  }
  return session
}

export async function saveSession(next: Session | null): Promise<void> {
  session = next
  try {
    if (next) await getStorage().set(SESSION_KEY, JSON.stringify(next))
    else await getStorage().remove(SESSION_KEY)
  } catch {
    /* storage unavailable — the session still works for this tab */
  }
}

export function hasRole(s: Session | null, ...roles: string[]): boolean {
  if (!s) return false
  if (s.roles.includes('admin')) return true
  return roles.some((r) => s.roles.includes(r))
}

export const isStaff = (s: Session | null) => hasRole(s, 'staff')
export const isTechnician = (s: Session | null) => hasRole(s, 'technician')
export const isAdmin = (s: Session | null) => !!s?.roles.includes('admin')
export const isOps = (s: Session | null) => isStaff(s) || isTechnician(s)

/**
 * Where the API lives. Web stays relative behind the dev proxy; a deployment
 * serving the app from another origin sets this to the API's URL.
 */
let origin = ''
export function setApiOrigin(value: string) {
  origin = value.replace(/\/$/, '')
}
const url = (p: string) => `${origin}/api/v1${p}`

/** Carries the server's own explanation, which is usually the useful part. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url(endpoint), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(init?.headers as Record<string, string> | undefined),
      },
    })
  } catch {
    throw new ApiError(0, `Could not reach the API at ${url(endpoint)}.`)
  }

  if (res.status === 401 && session) {
    // The token is gone or expired. Drop it and let the app react once.
    void saveSession(null)
    onExpired?.()
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.message) detail = body.message
    } catch {
      /* non-JSON error body; the status line is all we have */
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const get = <T,>(p: string) => request<T>(p)
const post = <T,>(p: string, body?: unknown) =>
  request<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) })
const put = <T,>(p: string, body?: unknown) =>
  request<T>(p, { method: 'PUT', body: JSON.stringify(body ?? {}) })

export interface BrowseParams {
  q?: string
  grade?: string
  maxPriceMinor?: number
  page?: number
  size?: number
}

export const api = {
  // -- auth ---------------------------------------------------------------
  requestCode: (contact: string) =>
    post<{ sent: boolean; expiresAt: string; devCode: string | null }>('/auth/request-code', { contact }),
  verifyCode: (contact: string, code: string) =>
    post<{
      token: string
      expiresAt: string
      user: { userId: string; displayName: string; email: string | null; roles: string[] }
    }>('/auth/verify', { contact, code }),
  me: () => get<{ userId: string; displayName: string; email: string | null; roles: string[] }>('/auth/me'),
  logout: () => post<{ ok: boolean }>('/auth/logout'),

  // -- catalogue (public) --------------------------------------------------
  listings(p: BrowseParams = {}) {
    const qs = new URLSearchParams()
    if (p.q) qs.set('q', p.q)
    if (p.grade) qs.set('grade', p.grade)
    if (p.maxPriceMinor) qs.set('maxPriceMinor', String(p.maxPriceMinor))
    qs.set('page', String(p.page ?? 0))
    qs.set('size', String(p.size ?? 60))
    return get<Page<Listing>>(`/listings?${qs}`)
  },
  listing: (id: string) => get<ListingDetail>(`/listings/${id}`),
  grades: () => get<Grade[]>('/grades'),
  reasonCodes: (domain: string) => get<ReasonCode[]>(`/reason-codes?domain=${encodeURIComponent(domain)}`),
  brands: () => get<Brand[]>('/brands'),
  categories: () => get<Category[]>('/categories'),
  models: () => get<Page<ProductModel>>('/models?size=500'),
  transitionRules: () => get<TransitionRule[]>('/transition-rules'),
  settings: () => get<PlatformSetting[]>('/settings'),
  feeQuote: (salePriceMinor: number) => get<FeeQuote>(`/fee-quote?salePriceMinor=${salePriceMinor}`),
  feeRules: () => get<FeeRule[]>('/fee-rules'),
  actors: () => get<ActorHint[]>('/dev/actors'),

  // -- buyer ---------------------------------------------------------------
  reserve: (listingId: string) => post<Reservation>(`/listings/${listingId}/reserve`),
  releaseReservation: (id: string) => post<Reservation>(`/reservations/${id}/release`),
  checkout: (reservationId: string, deliveryAddress: Record<string, unknown>) =>
    post<Order>(`/reservations/${reservationId}/checkout`, { deliveryAddress }),
  pay: (
    orderId: string,
    body: {
      gateway: string
      gatewayRef: string
      method?: string | null
      idempotencyKey: string
      gatewayFeeMinor?: number | null
    },
  ) => post<Payment>(`/orders/${orderId}/payments`, body),
  myOrders: () => get<Order[]>('/orders'),
  order: (id: string) => get<OrderDetail>(`/orders/${id}`),
  acceptLine: (lineId: string, byWindowExpiry = false) =>
    post<OrderLine>(`/order-lines/${lineId}/accept?byWindowExpiry=${byWindowExpiry}`),

  // -- identity ------------------------------------------------------------
  myKyc: () => get<KycStatus>('/kyc/mine'),
  submitKyc: (body: {
    legalName: string; dob?: string | null; idType: string; idNumber: string; gstin?: string | null
  }) => post<KycStatus>('/kyc', body),
  kycQueue: () => get<KycReview[]>('/kyc/queue'),
  verifyKyc: (userId: string) => post<KycReview>(`/kyc/${userId}/verify`),
  rejectKyc: (userId: string, reasonCode: string) =>
    post<KycReview>(`/kyc/${userId}/reject`, { reasonCode }),

  // -- seller --------------------------------------------------------------
  createSubmission: (pricingMode: string) => post<Submission>('/submissions', { pricingMode }),
  mySubmissions: () => get<Submission[]>('/submissions'),
  submission: (id: string) => get<SubmissionView>(`/submissions/${id}`),
  addItem: (
    submissionId: string,
    body: {
      productModelId?: string | null
      modelFreeText?: string | null
      serialNumber?: string | null
      declaredGradeCode: string
      askingAmountMinor: number
      floorAmountMinor?: number | null
      declaredValueMinor?: number | null
      includedAccessories?: string[] | null
    },
  ) => post<ConsignmentItem>(`/submissions/${submissionId}/items`, body),
  submitSubmission: (id: string) => post<Submission>(`/submissions/${id}/submit`),
  myItems: () => get<ConsignmentItem[]>('/items/mine'),
  item: (id: string) => get<ItemDetail>(`/items/${id}`),
  myApprovals: () => get<SellerApprovalView[]>('/seller-approvals'),
  approval: (id: string) => get<SellerApprovalView>(`/seller-approvals/${id}`),
  decideApproval: (id: string, decision: string, counterAmountMinor?: number | null) =>
    post<SellerApproval>(`/seller-approvals/${id}/decision`, {
      decision,
      counterAmountMinor: counterAmountMinor ?? null,
    }),
  myPayouts: () => get<Payout[]>('/payouts/mine'),
  myPayoutAccount: () => get<PayoutAccount | null>('/payout-accounts/mine'),
  addPayoutAccount: (body: {
    method: string
    accountHolderName: string
    accountNumber?: string | null
    ifsc?: string | null
    upiVpa?: string | null
  }) => post<PayoutAccount>('/payout-accounts', body),

  // -- ops -----------------------------------------------------------------
  pendingSubmissions: () => get<Submission[]>('/ops/submissions/pending'),
  preApprove: (id: string, courierCode: string) =>
    post<InboundShipment>(`/ops/submissions/${id}/pre-approve`, { courierCode }),
  rejectSubmission: (id: string, reasonCode: string) =>
    post<Submission>(`/ops/submissions/${id}/reject`, { reasonCode }),
  markInTransit: (shipmentId: string) =>
    post<InboundShipment>(`/ops/inbound-shipments/${shipmentId}/in-transit`),
  receive: (
    shipmentId: string,
    body: { outcomes: Record<string, string>; binCode?: string | null; notes?: string | null },
  ) => post<Intake>(`/ops/inbound-shipments/${shipmentId}/receive`, body),
  storageBins: () => get<StorageBin[]>('/ops/storage-bins'),
  submissionShipments: (submissionId: string) =>
    get<InboundShipment[]>(`/ops/submissions/${submissionId}/shipments`),

  itemQueue: (state?: string) =>
    get<ConsignmentItem[]>(`/items${state ? `?state=${encodeURIComponent(state)}` : ''}`),
  startInspection: (itemId: string) =>
    post<InspectionReport>(`/items/${itemId}/inspections?purpose=initial`),
  itemInspections: (itemId: string) => get<InspectionReport[]>(`/items/${itemId}/inspections`),
  checklistItems: (templateId: string) => get<ChecklistItem[]>(`/checklist-templates/${templateId}/items`),
  checklistTemplates: () => get<ChecklistTemplate[]>('/checklist-templates'),
  saveAnswers: (
    reportId: string,
    answers: Array<{
      checklistItemCode: string
      valueBoolean?: boolean | null
      valueNumeric?: number | null
      valueText?: string | null
      valueOption?: string | null
    }>,
  ) => put<InspectionAnswer[]>(`/inspections/${reportId}/answers`, answers),
  readAnswers: (reportId: string) => get<InspectionAnswer[]>(`/inspections/${reportId}/answers`),
  /** The item's latest report, rendered for reading. Null until something is inspected. */
  itemReport: (itemId: string) => get<RenderedReport | null>(`/items/${itemId}/inspection-report`),
  renderedReport: (reportId: string) => get<RenderedReport>(`/inspections/${reportId}/report`),
  addDefect: (
    reportId: string,
    body: {
      title: string
      severity: string
      descriptionPublic: string
      descriptionInternal?: string | null
      checklistItemCode?: string | null
    },
  ) => post<Defect>(`/inspections/${reportId}/defects`, body),
  suggestedGrade: (reportId: string) =>
    get<{ suggestedGradeCode: string | null }>(`/inspections/${reportId}/suggested-grade`),
  submitReport: (
    reportId: string,
    body: { proposedGradeCode: string; overrideReason?: string | null; verifiedShutterCount?: number | null },
  ) => post<InspectionReport>(`/inspections/${reportId}/submit`, body),
  qc: (
    reportId: string,
    body: { confirm: boolean; finalGradeCode?: string | null; overrideReason?: string | null; outcome: string },
  ) => post<InspectionReport>(`/inspections/${reportId}/qc`, body),

  propose: (itemId: string, body: { staffAmountMinor?: number | null; staffOverrideReason?: string | null }) =>
    post<ProposalOutcome>(`/items/${itemId}/price-proposals`, body),
  itemProposals: (itemId: string) => get<PriceProposal[]>(`/items/${itemId}/price-proposals`),
  itemSnapshots: (itemId: string) => get<FeeSnapshot[]>(`/items/${itemId}/fee-snapshots`),
  changeListingPrice: (listingId: string, newAmountMinor: number, reason: string) =>
    post<Listing>(`/listings/${listingId}/price`, { newAmountMinor, reason }),

  orderLines: (state?: string) =>
    get<OrderLine[]>(`/order-lines${state ? `?state=${encodeURIComponent(state)}` : ''}`),
  dispatchLine: (id: string) => post<OrderLine>(`/order-lines/${id}/dispatch`),
  deliverLine: (id: string) => post<OrderLine>(`/order-lines/${id}/deliver`),
  transitionItem: (id: string, toState: string, reasonCode?: string | null, note?: string | null) =>
    post<ConsignmentItem>(`/items/${id}/transition`, {
      toState,
      reasonCode: reasonCode ?? null,
      note: note ?? null,
    }),

  // -- admin ---------------------------------------------------------------
  payoutQueue: (state?: string) =>
    get<Payout[]>(`/payouts${state ? `?state=${encodeURIComponent(state)}` : ''}`),
  approvePayout: (id: string) => post<Payout>(`/payouts/${id}/approve`),
  payPayout: (id: string, transferRef: string) => post<Payout>(`/payouts/${id}/pay`, { transferRef }),
  ledgerAccounts: () => get<LedgerAccountBalance[]>('/ledger/accounts'),
  ledgerTransactions: (limit = 50) => get<LedgerTransactionView[]>(`/ledger/transactions?limit=${limit}`),
  reconciliation: () => get<Reconciliation>('/ledger/reconciliation'),
}
