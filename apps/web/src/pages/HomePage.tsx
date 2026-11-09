import { Link } from 'react-router-dom'
import { api, money, relative, useApi, useSession } from '@trueglaz/core'
import type { BuyerAsk, BuyerHome, BuyerOrder, HomeListing, HomeSale, HomeView, MediaView } from '@trueglaz/core'
import { photoKindFor } from '../components/GearPhoto'
import { ModelPhoto } from '../components/ModelPhoto'
import { srcSet } from '../components/Gallery'
import { ErrorNote, GradeBadge, Loading } from '../components/ui'
import './HomePage.css'

/**
 * The shop front (TG-80).
 *
 * TrueGlaz has two kinds of visitor, so the first screen has two doors: Buy,
 * the wider one because most visitors come to buy, and Sell, which starts at
 * sign-in and the one-time ID check. A signed-in buyer's own corner comes next,
 * then the Gear Vault invite, then two short shelves — what sold and for how
 * much (the thing a seller and a buyer both want to know), and what just came
 * in — and the four promises last, where "How it works" in the hero points.
 *
 * Shorter on purpose: the brand and mount chips, the top models and the ask
 * board live in Shop and Wanted, one click away, rather than as nine equal
 * sections nobody reads to the end.
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
  const signedIn = !!session

  return (
    <div className="home">
      <Doors d={d} inStock={inStock} />

      {session && (
        mine.error ? <ErrorNote error={mine.error} onRetry={mine.reload} />
          : mine.data ? <Corner b={mine.data} name={first} />
            : null
      )}

      <VaultInvite sales={d.recentlySold} />

      {d.recentlySold.length > 0 && (
        <Shelf
          compact
          kicker="Recently sold"
          title="What gear actually sells for here"
          blurb="Thinking of selling? This is what buyers paid."
        >
          {d.recentlySold.slice(0, 4).map((s) => <SoldCard key={s.id} sale={s} />)}
        </Shelf>
      )}

      {d.justIn.length > 0 && (
        <Shelf
          kicker="Just in"
          title="Fresh off the inspection bench"
          to="/catalog?sort=newest"
          linkText={`See all ${inStock} →`}
          aside={
            <Link to={signedIn ? '/wanted?ask=1' : '/wanted'} className="home__ask">
              Can't find it? Ask for it →
            </Link>
          }
        >
          {d.justIn.slice(0, 4).map((l) => <GearCard key={l.id} listing={l} />)}
        </Shelf>
      )}

      <Promises hours={d.returnWindowHours} />
    </div>
  )
}

// ------------------------------------------------------------------ doors --

function Doors({ d, inStock }: { d: HomeView; inStock: number }) {
  // Real units, so the first screen shows the thing rather than describing it:
  // the biggest saving first, then what came in last. Four show on a wide
  // screen; a phone gets all six as a rail it can push sideways.
  const seen = new Set<string>()
  const picks = [...d.bestSavings.slice(0, 1), ...d.justIn, ...d.bestSavings]
    .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)))
    .slice(0, 6)

  return (
    <div className="doors">
      <section className="door door--buy" aria-labelledby="door-buy">
        <p className="door__kicker">Buy</p>
        <h1 id="door-buy" className="door__title">Certified used gear. No guesswork.</h1>
        <p className="door__lede">
          Inspected and graded in our workshop, every defect photographed. {windowText(d.returnWindowHours)} to
          return it, and the seller is paid only after you keep it.
        </p>
        <div className="door__ctas">
          <Link to="/catalog" className="tg-button door__cta">Shop all {inStock} pieces</Link>
          <a href="#how" className="door__ghost">How it works</a>
        </div>
        {picks.length > 0 && (
          <div className="door__shelf">
            <div className="door__shelf-head">
              <span>Just in</span>
              <Link to="/catalog?sort=newest">See all {inStock} →</Link>
            </div>
            <ul className="door__picks">
              {picks.map((l) => <Pick key={l.id} l={l} />)}
            </ul>
          </div>
        )}
      </section>

      <section className="door door--sell" aria-labelledby="door-sell">
        <p className="door__kicker">Sell</p>
        <h2 id="door-sell" className="door__title">Selling gear? Skip the haggling.</h2>
        <p className="door__lede">We inspect it, price it and sell it. No meet-ups, no time-wasters.</p>
        <div className="door__ctas">
          {/* /sell is signed-in only: a visitor goes through sign-in and comes
              straight back, and selling asks for the one-time ID check before
              the first listing. */}
          <Link to="/sell" className="tg-button door__cta">Start selling</Link>
        </div>
        <p className="door__note">One sign-in and ID check, then list freely.</p>
        <ol className="door__steps">
          <li><strong>Sign in and verify</strong><span>A one-time ID check, required to sell.</span></li>
          <li><strong>Send it in</strong><span>We inspect, grade and price it from real sales.</span></li>
          <li><strong>Get paid</strong><span>To your bank once the buyer keeps it.</span></li>
        </ol>
      </section>
    </div>
  )
}

function Pick({ l }: { l: HomeListing }) {
  const name = l.title.split('·')[0].trim()
  return (
    <li>
      <Link to={`/listings/${l.id}`} className="pick">
        <Cover cover={l.cover} categorySlug={l.categorySlug} alt={name} modelSlug={l.modelSlug} />
        <span className="pick__name">{name}</span>
        <span className="pick__meta">{l.gradeCode} · {money(l.priceMinor)}</span>
      </Link>
    </li>
  )
}

// ------------------------------------------------------------ gear vault --

/**
 * The Vault invite. The card is an example, and says so: three things that
 * really sold here, at the price they sold for. Until the pricing platform
 * (TG-56) lands, our own sales are the only values we stand behind.
 */
function VaultInvite({ sales }: { sales: HomeSale[] }) {
  const rows = sales.slice(0, 3)
  const total = rows.reduce((n, s) => n + s.priceMinor, 0)
  return (
    <section className="vault-invite" aria-labelledby="vault-invite">
      <div className="vault-invite__copy">
        <p className="home__kicker">Gear Vault · free</p>
        <h2 id="vault-invite" className="vault-invite__title">What is your kit worth today?</h2>
        <p className="vault-invite__lede">
          Add the gear you own. We keep an estimate of its value from real sales, so you know what you could sell it
          for, or insure it for.
        </p>
        <ul className="vault-invite__list">
          <li>A value for every item and your whole kit</li>
          <li>Insure any item from the Vault</li>
          <li>See when it's a good time to sell</li>
        </ul>
        <Link to="/vault" className="tg-button tg-button--primary vault-invite__cta">Start your Gear Vault</Link>
      </div>
      {rows.length > 0 && (
        <div className="vault-card" aria-label="Example vault">
          <div className="vault-card__top">
            <span className="vault-card__label">Example vault</span>
            <strong className="vault-card__total">~{money(total)}</strong>
            <span className="vault-card__sub">{rows.length} {rows.length === 1 ? 'item' : 'items'}</span>
          </div>
          <ul className="vault-card__rows">
            {rows.map((s) => {
              const name = s.title.split('·')[0].trim()
              return (
                <li key={s.id} className="vault-card__row">
                  <Cover cover={s.cover} categorySlug={s.categorySlug} alt="" modelSlug={s.modelSlug} />
                  <span className="vault-card__name">
                    <strong>{name}</strong>
                    <span className="tg-muted">{s.gradeCode}{s.soldAt ? ` · sold here ${relative(s.soldAt)}` : ''}</span>
                  </span>
                  <strong className="vault-card__value">~{money(s.priceMinor)}</strong>
                </li>
              )
            })}
          </ul>
          <p className="vault-card__foot">Values from recent TrueGlaz sales · not an offer</p>
        </div>
      )}
    </section>
  )
}

// --------------------------------------------------------------- promises --

function Promises({ hours }: { hours: number }) {
  const items: { title: string; body: string }[] = [
    { title: 'Inspected by us', body: 'Bench-tested and graded in our workshop, not by the seller.' },
    { title: 'Every defect written down', body: 'Marks, haze, worn grips: listed and photographed before you buy.' },
    { title: `${windowText(hours)} to return`, body: 'After delivery. Not as described? Send it back for a full refund.' },
    { title: 'Seller paid only after', body: 'Your money is held until the return window closes or you keep it.' },
  ]
  return (
    <section id="how" className="promises" aria-labelledby="how-title">
      <h2 id="how-title" className="home__kicker promises__title">How buying here works</h2>
      <ol className="promises__list">
        {items.map((p, i) => (
          <li key={p.title} className="promise">
            <span className="promise__n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <strong className="promise__title">{p.title}</strong>
            <span className="promise__body">{p.body}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// -------------------------------------------------------------- your corner --

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
        <strong className="myask__what"><ModelPhoto slug={a.modelSlug} kind="gear" size="mini" alt="" badge={false} />{a.wanted}</strong>
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

// ---------------------------------------------------------------- shelves --

/** A short titled shelf of four, with a way through to the rest. */
function Shelf({
  kicker, title, blurb, to, linkText, aside, compact, children,
}: {
  /** Two on a phone rather than four: context, not the main shelf. */
  compact?: boolean
  kicker: string
  title: string
  blurb?: string
  to?: string
  linkText?: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="home__section">
      <div className="home__head">
        <div className="home__heading">
          <p className="home__kicker">{kicker}</p>
          <h2 className="home__title">{title}</h2>
          {blurb && <p className="home__blurb tg-muted">{blurb}</p>}
        </div>
        <div className="home__links">
          {aside}
          {to && <Link to={to} className="home__all">{linkText ?? 'See all →'}</Link>}
        </div>
      </div>
      <ol className={`shelf${compact ? ' shelf--compact' : ''}`}>{children}</ol>
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
        <Cover cover={sale.cover} categorySlug={sale.categorySlug} alt={name} modelSlug={sale.modelSlug} />
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
