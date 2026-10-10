import { Link } from 'react-router-dom'
import { api, money, relative, useApi, useSession } from '@trueglaz/core'
import type { BuyerAsk, BuyerHome, BuyerOrder, HomeListing, HomeSale, HomeView, MediaView } from '@trueglaz/core'
import { photoKindFor } from '../components/GearPhoto'
import { ModelPhoto } from '../components/ModelPhoto'
import { srcSet } from '../components/Gallery'
import { ErrorNote, GradeBadge, Loading } from '../components/ui'
import './HomePage.css'

/**
 * The shop front.
 *
 * Built in the order a used-gear buyer's doubts arrive. First: is this place
 * worth my time — a hero that says what it is, with one real deal in it and the
 * ways in (department, search, ask). Second: can I trust second-hand gear from
 * strangers — four promises, the return window read from the platform setting
 * rather than typed into the copy. Third, for someone signed in: where are my
 * things — their parcels, the clock on anything they can still send back, and
 * whether what they asked for has turned up. Only then the shelves.
 *
 * Every rail is a different slice of stock. A row that repeated the one above
 * would make a shop of thirty items look like a shop of six.
 */
export function HomePage() {
  const { session } = useSession()
  const home = useApi(() => api.home(), [])
  const mine = useApi(() => (session ? api.buyerHome() : Promise.resolve(null)), [session?.userId])

  if (home.loading) return <Loading label="Loading" />
  if (home.error) return <ErrorNote error={home.error} onRetry={home.reload} />
  if (!home.data) return null

  const d = home.data
  const inStock = d.brands.reduce((n, b) => n + b.liveCount, 0)
  const first = (session?.displayName ?? '').split(' ')[0]
  const hasHistory = (mine.data?.orders.length ?? 0) > 0

  return (
    <div className="home">
      <Hero d={d} inStock={inStock} signedIn={!!session} />
      <Promises hours={d.returnWindowHours} />

      {session && (
        mine.error ? <ErrorNote error={mine.error} onRetry={mine.reload} />
          : mine.data ? <Corner b={mine.data} name={first} />
            : null
      )}

      {d.justIn.length > 0 && (
        <Row title="Just in" blurb="The most recent arrivals, freshly graded." to="/catalog?sort=newest">
          {d.justIn.map((l) => <GearCard key={l.id} listing={l} />)}
        </Row>
      )}

      {/* Someone who has bought here already knows how it works. */}
      {!hasHistory && <HowItWorks hours={d.returnWindowHours} />}

      {d.bestSavings.length > 0 && (
        <Row
          title="Biggest savings"
          blurb="What these cost new, against what they cost here."
          to="/catalog?sort=price-asc"
        >
          {d.bestSavings.map((l) => <GearCard key={l.id} listing={l} showSaving />)}
        </Row>
      )}

      {(d.brands.length > 0 || d.mounts.length > 0) && (
        <section className="home__section home__shopby" aria-label="Shop by">
          {d.brands.length > 0 && (
            <div className="shopby">
              <h2 className="home__kicker">Shop by brand</h2>
              <ul className="home-chips">
                {d.brands.map((b) => (
                  <li key={b.name}>
                    <Link className="home-chip" to={`/catalog?brand=${encodeURIComponent(b.name)}`}>
                      {b.name} <span className="home-chip__n">{b.liveCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.mounts.length > 0 && (
            <div className="shopby">
              <h2 className="home__kicker">Shop by mount</h2>
              <p className="shopby__note tg-muted">The first question a lens buyer asks: will it fit my body?</p>
              <ul className="home-chips">
                {d.mounts.map((m) => (
                  <li key={m.name}>
                    <Link className="home-chip" to={`/catalog?mount=${encodeURIComponent(m.name)}`}>
                      {m.name} <span className="home-chip__n">{m.liveCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {d.recentlySold.length > 0 && (
        <Row
          title="Recently sold"
          blurb="What gear actually goes for here — the one thing a listing page cannot tell you."
        >
          {d.recentlySold.map((s) => <SoldCard key={s.id} sale={s} />)}
        </Row>
      )}

      <div className="home__pair">
        {d.topModels.length > 0 && (
          <section className="home__section">
            <div className="home__head">
              <h2 className="home__title">What people buy here</h2>
              <p className="home__blurb tg-muted">Every unit is one of one, so this counts models, not items.</p>
            </div>
            <ol className="home__models">
              {d.topModels.map((m, i) => (
                <li key={`${m.brandName}-${m.modelName}`} className="model">
                  <span className="model__rank">{i + 1}</span>
                  <div className="model__name">
                    <span className="tg-muted">{m.brandName}</span> {m.modelName}
                    <span className="model__stat tg-muted"> · {m.soldCount} sold</span>
                  </div>
                  {m.liveCount > 0 ? (
                    <Link className="model__cta" to={`/catalog?q=${encodeURIComponent(m.modelName)}`}>
                      {m.liveCount} from {m.fromPriceMinor != null ? money(m.fromPriceMinor) : '—'} →
                    </Link>
                  ) : (
                    <span className="model__gone tg-muted">None in stock</span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
        <AskPanel d={d} signedIn={!!session} />
      </div>
    </div>
  )
}

// -------------------------------------------------------------------- hero --

function Hero({ d, inStock, signedIn }: { d: HomeView; inStock: number; signedIn: boolean }) {
  // One real unit, so the first screen shows the thing rather than describing it:
  // the biggest saving if anything has one, else whatever came in last.
  const pick = d.bestSavings[0] ?? d.justIn[0]
  return (
    <section className="hero">
      <div className="hero__copy">
        <p className="hero__eyebrow">Pre-owned camera gear · inspected in our workshop</p>
        <h1 className="hero__headline">Used gear,<br />graded honestly.</h1>
        <p className="hero__sub">
          Every unit is inspected, graded and photographed by us, and every defect we found is
          written down before you buy. One of each — when it is gone, it is gone.
        </p>
        <div className="hero__ctas">
          <Link to="/catalog" className="tg-button hero__cta">Browse all {inStock} pieces</Link>
          <Link to={signedIn ? '/wanted?ask=1' : '/wanted'} className="hero__ghost">
            Looking for something specific?
          </Link>
        </div>
        {d.categories.length > 0 && (
          <ul className="hero__cats" aria-label="Departments">
            {d.categories.map((c) => (
              <li key={c.name}>
                <Link to={`/catalog?cat=${encodeURIComponent(c.slug ?? '')}`} className="hero__cat">
                  {c.name} <span>{c.liveCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {pick && (
        <Link to={`/listings/${pick.id}`} className="hero__feature">
          <Cover cover={pick.cover} categorySlug={pick.categorySlug} alt={pick.title} modelSlug={pick.modelSlug} />
          <span className="hero__feature-body">
            <span className="hero__feature-tag">{pick.savedMinor ? 'Biggest saving today' : 'Just in'}</span>
            <span className="hero__feature-name">{pick.title.split('·')[0].trim()}</span>
            <span className="hero__feature-meta">
              <GradeBadge code={pick.gradeCode} />
              {pick.gradeLabel && <span>{pick.gradeLabel}</span>}
            </span>
            <span className="hero__feature-price">
              <strong>{money(pick.priceMinor)}</strong>
              {pick.savedMinor != null && pick.msrpMinor != null && (
                <span className="hero__feature-was">
                  <s>{money(pick.msrpMinor)}</s> new
                </span>
              )}
            </span>
          </span>
        </Link>
      )}
    </section>
  )
}

function Promises({ hours }: { hours: number }) {
  const items: { icon: React.ReactNode; title: string; body: string }[] = [
    { icon: <IconLens />, title: 'Inspected by us', body: 'Bench-tested and graded in our workshop, not by the seller.' },
    { icon: <IconList />, title: 'Every defect written down', body: 'Marks, haze, worn grips — listed and photographed before you buy.' },
    { icon: <IconClock />, title: `${windowText(hours)} to return`, body: 'After delivery. Not as described? Send it back for a full refund.' },
    { icon: <IconShield />, title: 'Seller paid only after', body: 'Your money is held until the return window closes or you keep it.' },
  ]
  return (
    <ul className="promises" aria-label="What every purchase comes with">
      {items.map((p) => (
        <li key={p.title} className="promise">
          <span className="promise__icon" aria-hidden="true">{p.icon}</span>
          <span>
            <strong className="promise__title">{p.title}</strong>
            <span className="promise__body">{p.body}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function HowItWorks({ hours }: { hours: number }) {
  return (
    <section className="home__section how" aria-label="How buying works">
      <h2 className="home__kicker">How buying here works</h2>
      <ol className="how__steps">
        <li><span className="how__n">1</span><strong>Read the report</strong><span>Grade, photos of this exact unit, and every defect we found.</span></li>
        <li><span className="how__n">2</span><strong>Pay securely</strong><span>We hold the money. The seller is not paid yet.</span></li>
        <li><span className="how__n">3</span><strong>Try it at home</strong><span>You have {windowText(hours)} after delivery to return it.</span></li>
        <li><span className="how__n">4</span><strong>Keep it</strong><span>Only then is the seller paid. Nothing to chase.</span></li>
      </ol>
    </section>
  )
}

// ------------------------------------------------------------ your corner --

/**
 * The signed-in buyer's own strip: what needs them, where their parcels are,
 * and what they asked for. Empty parts are left out rather than shown as
 * empty boxes; a first-time buyer gets one line inviting them to ask.
 */
function Corner({ b, name }: { b: BuyerHome; name: string }) {
  const live = b.orders.filter((o) => LIVE.has(o.stage))
  const done = b.orders.filter((o) => !LIVE.has(o.stage))
  const nothing = b.orders.length === 0 && b.asks.length === 0
  return (
    <section className="corner" aria-label="Your orders and requests">
      <div className="corner__head">
        <h2 className="corner__title">{name ? `Welcome back, ${name}` : 'Welcome back'}</h2>
        <ul className="corner__stats">
          <li><strong>{b.stats.inProgress}</strong> on the way to you</li>
          <li><strong>{b.stats.bought}</strong> bought</li>
          <li><strong>{b.stats.openAsks}</strong> {b.stats.openAsks === 1 ? 'request' : 'requests'} open</li>
        </ul>
        <Link to="/orders" className="corner__all">All orders →</Link>
      </div>

      {b.actions.length > 0 && (
        <div className="corner__todo">
          {b.actions.map((a) => {
            const inner = (
              <>
                <span className="home-task__n">{a.count}</span>
                <span className="home-task__body"><strong>{a.title}</strong><span>{a.hint}</span></span>
                <span className="home-task__go" aria-hidden="true">→</span>
              </>
            )
            // "#asks" points further down this page, so it is a plain anchor, not a route.
            return a.href.startsWith('#')
              ? <a key={a.key} href={a.href} className={`home-task home-task--${a.tone}`}>{inner}</a>
              : <Link key={a.key} to={a.href} className={`home-task home-task--${a.tone}`}>{inner}</Link>
          })}
        </div>
      )}

      {nothing ? (
        <p className="corner__empty">
          Nothing on order yet. Can't see what you want below?{' '}
          <Link to="/wanted?ask=1">Tell us what you're looking for</Link> and we'll show you here when one arrives.
        </p>
      ) : (
        <div className="corner__cols">
          <div className="corner__orders">
            <h3 className="home__kicker">Your orders</h3>
            {b.orders.length === 0 ? (
              <p className="corner__muted">Nothing on order.</p>
            ) : (
              <ul className="parcels">
                {[...live, ...done].map((o) => <Parcel key={o.lineId} o={o} />)}
              </ul>
            )}
          </div>
          <div className="corner__asks" id="asks">
            <h3 className="home__kicker">You asked for</h3>
            {b.asks.length === 0 ? (
              <p className="corner__muted">
                No open requests. <Link to="/wanted?ask=1">Ask for something</Link> — we'll match it against
                everything that comes in.
              </p>
            ) : (
              <ul className="myasks">{b.asks.map((a) => <MyAsk key={a.id} a={a} />)}</ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

const LIVE = new Set(['paying', 'preparing', 'on_the_way', 'delivered', 'returning'])
const STEPS = ['Paid', 'Shipped', 'Delivered', 'Yours']
const STEP_OF: Record<string, number> = { paying: -1, preparing: 0, on_the_way: 1, delivered: 2, yours: 3, kept_after_return: 3 }

function Parcel({ o }: { o: BuyerOrder }) {
  const step = STEP_OF[o.stage]
  const left = timeLeft(o.windowEndsAt)
  return (
    <li className={`parcel parcel--${o.stage}`}>
      <Link to={`/listings/${o.listingId}`} className="parcel__thumb">
        <Cover cover={o.cover} categorySlug={o.categorySlug} alt={o.title} modelSlug={o.modelSlug} />
      </Link>
      <div className="parcel__body">
        <div className="parcel__top">
          <Link to="/orders" className="parcel__name">{o.title}</Link>
          <span className="parcel__price">{money(o.priceMinor)}</span>
        </div>
        <p className={`parcel__status parcel__status--${toneOf(o)}`}>{statusOf(o, left)}</p>
        {step !== undefined && step >= 0 && (
          <ol className="home-steps" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s} className={`home-steps__s${i <= step ? ' home-steps__s--done' : ''}${i === step ? ' home-steps__s--now' : ''}`}>{s}</li>
            ))}
          </ol>
        )}
        <p className="parcel__meta tg-muted">
          {o.orderNumber}
          {o.placedAt && ` · ordered ${relative(o.placedAt)}`}
          {o.trackingNumber && o.stage === 'on_the_way' && ` · ${o.courierCode ?? 'courier'} ${o.trackingNumber}`}
        </p>
      </div>
    </li>
  )
}

const RETURN_TEXT: Record<string, string> = {
  requested: 'Return requested — we will reply shortly',
  approved: 'Return approved — send it back with the label on your order',
  declined: 'Return declined — see your order for why',
  received: 'We have your return and are checking it',
  inspected: 'Your return has been checked; decision coming',
  escalated: 'Your return is with our team for a decision',
  refunded: 'Returned and refunded',
  sale_stands: 'The sale stands; the item is on its way back to you',
}

function statusOf(o: BuyerOrder, left: string | null): string {
  switch (o.stage) {
    case 'paying': return 'Waiting for your payment'
    case 'preparing': return 'Paid — we are packing it'
    case 'on_the_way': return 'On its way to you'
    case 'delivered': return left ? `Delivered — ${left} left to return it` : 'Delivered — the return window has closed'
    case 'returning': return RETURN_TEXT[o.returnState ?? 'requested'] ?? 'Return in progress'
    case 'yours': return 'Yours — enjoy it'
    case 'kept_after_return': return 'Yours — the return was not accepted'
    case 'refunded': return 'Returned and refunded'
    default: return 'Cancelled — your money is refunded'
  }
}

function toneOf(o: BuyerOrder): string {
  if (o.stage === 'delivered' || (o.stage === 'returning' && o.returnState === 'approved')) return 'urgent'
  if (o.stage === 'yours') return 'good'
  if (LIVE.has(o.stage)) return 'live'
  return 'quiet'
}

function MyAsk({ a }: { a: BuyerAsk }) {
  return (
    <li className={`myask${a.matchCount > 0 ? ' myask--hit' : ''}`}>
      <div className="myask__top">
        <strong>{a.wanted}</strong>
        {a.state === 'submitted' && <span className="myask__review">Being reviewed</span>}
      </div>
      <p className="myask__terms tg-muted">
        {[a.minGradeCode && `${a.minGradeCode} or better`, a.maxPriceMinor != null && `up to ${money(a.maxPriceMinor)}`]
          .filter(Boolean).join(' · ') || 'Any grade, any price'}
      </p>
      {a.matchCount > 0 ? (
        <>
          <p className="myask__hit">★ {a.matchCount} in stock {a.matchCount === 1 ? 'fits' : 'fit'} what you asked for</p>
          <ul className="myask__matches">
            {a.matches.map((m) => (
              <li key={m.listingId}>
                <Link to={`/listings/${m.listingId}`} className="myask__match">
                  <GradeBadge code={m.gradeCode} />
                  <span className="myask__match-name">{m.title}</span>
                  <strong>{money(m.priceMinor)}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="myask__none tg-muted">
          {a.nearCount > 0
            ? `${a.nearCount} of this model in stock, outside your grade or budget.`
            : 'Nothing yet. We will match it against everything that comes in.'}
        </p>
      )}
    </li>
  )
}

// --------------------------------------------------------------- the ask --

function AskPanel({ d, signedIn }: { d: HomeView; signedIn: boolean }) {
  return (
    <section className="askpanel" aria-label="Ask for something">
      <h2 className="askpanel__title">Can't find it?</h2>
      <p className="askpanel__lede">
        Tell us what you're after, at what grade and price. Sellers see the board, and you'll see it here the
        moment one comes in.
      </p>
      <Link to={signedIn ? '/wanted?ask=1' : '/sign-in'} className="tg-button tg-button--primary askpanel__cta">
        {signedIn ? "Tell us what you're looking for" : 'Sign in to ask for something'}
      </Link>
      {d.wanted.length > 0 && (
        <>
          <h3 className="home__kicker askpanel__kicker">Others are looking for</h3>
          <ul className="home__asks">
            {d.wanted.map((w) => (
              <li key={w.id} className="ask">
                <span className="ask__what">{w.wanted}</span>
                <span className="ask__terms tg-muted">
                  {[w.minGradeCode && `${w.minGradeCode}+`, w.maxPriceMinor != null && `≤ ${money(w.maxPriceMinor)}`].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          <p className="askpanel__foot">
            <Link to="/wanted">See the whole board</Link> · Have one of these? <Link to="/sell">Sell it here</Link>
          </p>
        </>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ rails --

/** A titled row, with a way through to the filtered catalogue behind it. */
function Row({
  title, blurb, to, children,
}: {
  title: string
  blurb: string
  to?: string
  children: React.ReactNode
}) {
  return (
    <section className="home__section">
      <div className="home__head">
        <h2 className="home__title">{title}</h2>
        <p className="home__blurb tg-muted">{blurb}</p>
        {to && <Link to={to} className="home__all">See all →</Link>}
      </div>
      {/* Scrolls sideways when it does not fit, rather than wrapping into a
          second ragged line that reads as a grid pretending to be a row. */}
      <ol className="home-rail">{children}</ol>
    </section>
  )
}

function GearCard({ listing, showSaving }: { listing: HomeListing; showSaving?: boolean }) {
  const name = listing.title.split('·')[0].trim()
  return (
    <li className="card">
      <Link to={`/listings/${listing.id}`} className="card__link">
        <Cover cover={listing.cover} categorySlug={listing.categorySlug} alt={name} modelSlug={listing.modelSlug} />
        {showSaving && listing.savedPct != null && <span className="card__flag">−{listing.savedPct}%</span>}
        <span className="card__name">{name}</span>
      </Link>
      <span className="card__brand tg-muted">{listing.brandName ?? 'Unlisted model'}</span>
      <span className="card__grade">
        <GradeBadge code={listing.gradeCode} />
        {listing.gradeLabel && <span className="tg-muted">{listing.gradeLabel}</span>}
      </span>
      <strong className="card__price">{money(listing.priceMinor)}</strong>
      {/* Only shown where it is the point of the row. A saving on every card
          everywhere turns into wallpaper and stops being read. */}
      {showSaving && listing.savedMinor != null && (
        <span className="card__saving">{money(listing.savedMinor)} less than new</span>
      )}
    </li>
  )
}

function SoldCard({ sale }: { sale: HomeSale }) {
  const name = sale.title.split('·')[0].trim()
  return (
    <li className="card card--sold">
      <Link to={`/listings/${sale.id}`} className="card__link">
        <Cover cover={sale.cover} categorySlug={sale.categorySlug} alt={name} />
        <span className="card__flag card__flag--sold">Sold</span>
        <span className="card__name">{name}</span>
      </Link>
      <span className="card__grade">
        <GradeBadge code={sale.gradeCode} />
        {sale.gradeLabel && <span className="tg-muted">{sale.gradeLabel}</span>}
      </span>
      <strong className="card__price">{money(sale.priceMinor)}</strong>
      {sale.soldAt && <span className="card__when tg-muted">Sold {relative(sale.soldAt)}</span>}
    </li>
  )
}

/**
 * The photograph on a tile, or the drawn stand-in for one.
 *
 * A rail is the one place a missing photograph is least forgivable — a row of
 * identical grey placeholders reads as a broken page rather than as a shop that
 * has not finished its photography.
 */
function Cover({ cover, categorySlug, alt, modelSlug }: {
  cover: MediaView | null
  categorySlug: string | null
  alt: string
  modelSlug?: string | null
}) {
  // A photograph of the actual unit first, always. The model's stock picture
  // only stands in when there is none, and says so when it does.
  if (!cover) {
    return (
      <span className="card__photo">
        <ModelPhoto slug={modelSlug} kind={photoKindFor(categorySlug)} alt={alt} />
      </span>
    )
  }
  return (
    <span className="card__photo">
      <img
        src={cover.sizes[400] ?? cover.url}
        srcSet={srcSet(cover)}
        /* A tile is never wider than about 260px, so telling the browser that
           stops it reaching for the 1200px rendition on a high-DPI phone. */
        sizes="(max-width: 720px) 70vw, 260px"
        alt={alt}
        loading="lazy"
      />
    </span>
  )
}

// ---------------------------------------------------------------- helpers --

function windowText(hours: number): string {
  if (hours % 24 === 0 && hours >= 48) return `${hours / 24} days`
  return `${hours} hours`
}

function timeLeft(iso: string | null): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms) || ms <= 0) return null
  const mins = Math.ceil(ms / 60_000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

const svg = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
function IconLens() { return <svg {...svg}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v5M21 12h-5M12 21v-5M3 12h5" /></svg> }
function IconList() { return <svg {...svg}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></svg> }
function IconClock() { return <svg {...svg}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg> }
function IconShield() { return <svg {...svg}><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg> }
