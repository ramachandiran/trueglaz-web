import { Link } from 'react-router-dom'
import { api, money, relative, useApi, useSession } from '@trueglaz/core'
import type { BuyerHome, HomeListing, HomeSale, HomeView, MediaView, VaultItem } from '@trueglaz/core'
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
 * sign-in and the one-time ID check. Then the Gear Vault invite, then two short shelves — what sold and for how
 * much (the thing a seller and a buyer both want to know), and what just came
 * in — and the four promises last, where "How it works" in the hero points.
 * A signed-in person gets their own page instead: see [Me].
 *
 * Shorter on purpose: the brand and mount chips, the top models and the ask
 * board live in Shop and Wanted, one click away, rather than as nine equal
 * sections nobody reads to the end.
 */
export function HomePage() {
  const { session } = useSession()
  const home = useApi(() => api.home(), [])
  const mine = useApi(() => (session ? api.buyerHome() : Promise.resolve(null)), [session?.userId])
  const vault = useApi(() => (session ? api.vault() : Promise.resolve(null)), [session?.userId])

  if (home.loading) return <Loading label="Loading" />
  if (home.error) return <ErrorNote error={home.error} onRetry={home.reload} />
  if (!home.data) return null

  const d = home.data
  const inStock = d.brands.reduce((n, b) => n + b.liveCount, 0)
  const first = (session?.displayName ?? '').split(' ')[0]
  const signedIn = !!session

  const sold = d.recentlySold.length > 0 && (
    <Shelf
      compact
      kicker="Recently sold"
      title="What gear actually sells for here"
      blurb="Thinking of selling? This is what buyers paid."
    >
      {d.recentlySold.slice(0, 4).map((s) => <SoldCard key={s.id} sale={s} />)}
    </Shelf>
  )
  const justIn = d.justIn.length > 0 && (
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
  )

  // Someone signed in has already chosen to be here: their own tiles lead, new
  // arrivals come before sold prices, and the visitor's pitch (the Buy / Sell
  // doors, the vault invite, how it works) is left out.
  if (signedIn) {
    return (
      <div className="home">
        {mine.error
          ? <ErrorNote error={mine.error} onRetry={mine.reload} />
          : <Me b={mine.data ?? null} vault={vault.data ?? null} name={first} />}
        {justIn}
        {sold}
      </div>
    )
  }

  return (
    <div className="home">
      <Doors d={d} inStock={inStock} />
      <VaultInvite sales={d.recentlySold} />
      {sold}
      {justIn}
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
          <Link to="/catalog" className="tg-button tg-button--primary home-cta">Shop all {inStock} pieces</Link>
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
          <Link to="/sell" className="tg-button tg-button--primary home-cta">Start selling</Link>
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
        <Link to="/vault" className="tg-button tg-button--primary home-cta">Start your Gear Vault</Link>
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

// ------------------------------------------------------------- signed in --

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/**
 * A signed-in person's top of the page. No order details: those live in
 * Orders, and a count with a link is all the home page needs ("2 orders on
 * the way", only when there are some). The rest is three tiles, each a reason
 * to come back today, each with one button:
 * - what they asked for is in stock (else: ask for it);
 * - what their kit is worth (else: add it to the vault);
 * - what their most valuable item could sell for (hidden if nothing valued).
 * Empty data never shows an empty box: every tile has a fallback or is left out.
 */
function Me({ b, vault, name }: { b: BuyerHome | null; vault: VaultItem[] | null; name: string }) {
  const onTheWay = b?.stats.inProgress ?? 0
  const ask = b?.asks.find((a) => (a.matchCount ?? 0) > 0) ?? null
  const items = vault ?? []
  const worth = items.reduce((n, i) => n + (i.valuation?.midMinor ?? i.costMinor ?? 0), 0)
  const insured = items.filter((i) => i.policy).length
  const best = [...items].filter((i) => i.valuation).sort((x, y) => y.valuation!.midMinor - x.valuation!.midMinor)[0] ?? null

  return (
    <section className="me" aria-labelledby="me-title">
      <div className="me__top">
        <h1 id="me-title" className="me__hi">{greeting()}{name ? `, ${name}` : ''}</h1>
        {onTheWay > 0 && (
          <Link to="/orders" className="me__chip">
            <span className="me__dot" aria-hidden="true" />
            <b>{onTheWay}</b> {onTheWay === 1 ? 'order' : 'orders'} on the way · Track
          </Link>
        )}
      </div>

      <div className="me__tiles">
        {ask ? (
          <div className="tile tile--navy">
            <p className="tile__k">Matches your request</p>
            <h2 className="tile__t">
              The {ask.matches[0]?.title ?? ask.wanted} you asked for: {ask.matchCount} in stock at your price
            </h2>
            {ask.matches.slice(0, 2).map((m) => (
              <Link key={m.listingId} to={`/listings/${m.listingId}`} className="tile__match">
                <span><i>{m.gradeCode}</i>{m.title}</span><b>{money(m.priceMinor)}</b>
              </Link>
            ))}
            <Link to="/wanted" className="tg-button tg-button--primary tile__cta">See matches</Link>
          </div>
        ) : (
          <div className="tile tile--navy">
            <p className="tile__k">Wanted</p>
            <h2 className="tile__t">Can't find the gear you want? Tell us and we'll tell you when it's in.</h2>
            <Link to="/wanted?ask=1" className="tg-button tg-button--primary tile__cta">Ask for it</Link>
          </div>
        )}

        {items.length > 0 ? (
          <div className="tile tile--cream">
            <p className="tile__k">Your Gear Vault</p>
            <div className="tile__big">~{money(worth)}</div>
            <p className="tile__sub">
              {items.length} {items.length === 1 ? 'item' : 'items'} · {insured ? `${insured} insured` : 'none insured yet'} · valued from real sales
            </p>
            <Link to="/vault" className="tg-button tile__cta">Open your vault</Link>
          </div>
        ) : (
          <div className="tile tile--cream">
            <p className="tile__k">Gear Vault · free</p>
            <h2 className="tile__t">What is your kit worth today?</h2>
            <p className="tile__sub">Add what you own. We value it from real sales, and you can insure it.</p>
            <Link to="/vault" className="tg-button tile__cta">Add your gear</Link>
          </div>
        )}

        {best && (
          <div className="tile tile--cream">
            <p className="tile__k">Upgrading?</p>
            <h2 className="tile__t">Your {best.modelLabel} could fetch ~{money(best.valuation!.midMinor)}</h2>
            <p className="tile__sub">We inspect it, price it and sell it. Paid to your bank once the buyer keeps it.</p>
            <Link to="/sell" className="tg-button tile__cta">Sell it with us</Link>
          </div>
        )}
      </div>
    </section>
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
