import { getStorage } from './storage'
import type {
  ActorHint, Brand, Category, Grade, ItemDetail, Listing, ListingDetail,
  Page, ProductModel, TransitionRule, ConsignmentItem,
} from './types'

/**
 * The API has no authentication yet: it identifies the caller from two headers.
 * Until OTP and sessions exist, the app holds a selected actor and sends it on
 * every request. Swapping this for a real session token is a change to
 * `authHeaders` alone.
 */
export interface Actor {
  userId: string
  role: string
  displayName: string
}

const ACTOR_KEY = 'trueglaz.actor'

export async function loadActor(): Promise<Actor | null> {
  try {
    const raw = await getStorage().get(ACTOR_KEY)
    return raw ? (JSON.parse(raw) as Actor) : null
  } catch {
    return null
  }
}

export async function saveActor(actor: Actor | null): Promise<void> {
  try {
    if (actor) await getStorage().set(ACTOR_KEY, JSON.stringify(actor))
    else await getStorage().remove(ACTOR_KEY)
  } catch {
    /* private mode or no storage — the app works, it just forgets the actor */
  }
}

function authHeaders(actor: Actor | null): Record<string, string> {
  if (!actor) return {}
  return { 'X-Actor-Id': actor.userId, 'X-Actor-Role': actor.role }
}

/** An API error carrying the server's own explanation, which is usually the useful part. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Where the API lives.
 *
 * On web this stays relative: the dev server proxies /api, which is also how the
 * missing CORS policy is sidestepped. Native has no proxy and no same-origin
 * rule, so the mobile app sets an absolute origin at startup.
 */
let origin = ''

export function setApiOrigin(value: string) {
  origin = value.replace(/\/$/, '')
}

const path = (p: string) => `${origin}/api/v1${p}`

async function request<T>(endpoint: string, actor: Actor | null, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path(endpoint), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...authHeaders(actor),
        ...(init?.headers as Record<string, string> | undefined),
      },
    })
  } catch {
    throw new ApiError(0, `Could not reach the API at ${path(endpoint)}.`)
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
  return (await res.json()) as T
}

export interface BrowseParams {
  q?: string
  grade?: string
  maxPriceMinor?: number
  page?: number
  size?: number
}

export const api = {
  /**
   * Server-side filtering is limited to text, a single grade and a price ceiling
   * — that is everything `GET /listings` accepts. Brand, category and
   * multi-grade faceting are applied in the browser (see lib/filters.ts).
   */
  listings(actor: Actor | null, p: BrowseParams = {}) {
    const qs = new URLSearchParams()
    if (p.q) qs.set('q', p.q)
    if (p.grade) qs.set('grade', p.grade)
    if (p.maxPriceMinor) qs.set('maxPriceMinor', String(p.maxPriceMinor))
    qs.set('page', String(p.page ?? 0))
    qs.set('size', String(p.size ?? 60))
    return request<Page<Listing>>(`/listings?${qs}`, actor)
  },

  listing: (actor: Actor | null, id: string) => request<ListingDetail>(`/listings/${id}`, actor),
  item: (actor: Actor | null, id: string) => request<ItemDetail>(`/items/${id}`, actor),

  items(actor: Actor | null, state?: string) {
    const qs = state ? `?state=${encodeURIComponent(state)}` : ''
    return request<ConsignmentItem[]>(`/items${qs}`, actor)
  },

  grades: (actor: Actor | null) => request<Grade[]>('/grades', actor),
  brands: (actor: Actor | null) => request<Brand[]>('/brands', actor),
  categories: (actor: Actor | null) => request<Category[]>('/categories', actor),
  models: (actor: Actor | null) => request<Page<ProductModel>>('/models?size=500', actor),
  transitionRules: (actor: Actor | null) => request<TransitionRule[]>('/transition-rules', actor),
  actors: (actor: Actor | null) => request<ActorHint[]>('/dev/actors', actor),
}
