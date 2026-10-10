import { Link } from 'react-router-dom'
import { api, money, relative, useApi } from '@trueglaz/core'
import type { HomeListing, HomeSale, MediaView } from '@trueglaz/core'
import { photoKindFor } from '../components/GearPhoto'
import { ModelPhoto } from '../components/ModelPhoto'
import { srcSet } from '../components/Gallery'
import { ErrorNote, GradeBadge, Loading } from '../components/ui'
import './HomePage.css'

/**
 * The shop front.
 *
 * The home page used to be the catalogue with a filter sidebar, which asks a
 * visitor to already know what they want. Most do not: they want to see what
 * there is, what it costs, and whether anybody else buys here. So the page is
 * sections now, and the filtered grid moved to /catalog — every "See all" lands
 * there with the filter already applied, so nothing was taken away.
 *
 * Every row is a different slice of stock. A row that repeated the one above it
 * would make a shop of thirty items look like a shop of six.
 */
export function HomePage() {
  const home = useApi(() => api.home(), [])

  if (home.loading) return <Loading label="Loading" />
  if (home.error) return <ErrorNote error={home.error} onRetry={home.reload} />
  if (!home.data) return null

  const d = home.data
  const inStock = d.brands.reduce((n, b) => n + b.liveCount, 0)

  return (
    <div className="home">
      <section className="home__intro">
        <h1 className="home__headline">Used gear, graded honestly.</h1>
        <p className="home__sub tg-muted">
          Every unit is inspected, graded and photographed by us, and every defect we
          found is written down before you buy. {inStock} pieces in stock right now —
          and because each one is a single second-hand item, there is exactly one of each.
        </p>
      </section>

      {d.justIn.length > 0 && (
        <Row title="Just in" blurb="The most recent arrivals, freshly graded." to="/catalog?sort=newest">
          {d.justIn.map((l) => <GearCard key={l.id} listing={l} />)}
        </Row>
      )}

      {d.bestSavings.length > 0 && (
        <Row
          title="Biggest savings"
          blurb="What these cost new, against what they cost here."
          to="/catalog?sort=price-asc"
        >
          {d.bestSavings.map((l) => <GearCard key={l.id} listing={l} showSaving />)}
        </Row>
      )}

      {d.brands.length > 0 && (
        <Row title="Shop by brand" blurb="Everything we have in stock, by maker.">
          {d.brands.map((b) => (
            <Tile
              key={b.name}
              to={`/catalog?brand=${encodeURIComponent(b.name)}`}
              label={b.name}
              count={b.liveCount}
            />
          ))}
        </Row>
      )}

      {d.mounts.length > 0 && (
        <Row
          title="Shop by mount"
          blurb="The question a lens buyer asks first: will it fit my body?"
        >
          {d.mounts.map((m) => (
            <Tile
              key={m.name}
              to={`/catalog?mount=${encodeURIComponent(m.name)}`}
              label={`${m.name} mount`}
              count={m.liveCount}
            />
          ))}
        </Row>
      )}

      {d.recentlySold.length > 0 && (
        <Row
          title="Recently sold"
          blurb="What gear actually goes for here — the one thing a listing page cannot tell you."
        >
          {d.recentlySold.map((s) => <SoldCard key={s.id} sale={s} />)}
        </Row>
      )}

      {d.topModels.length > 0 && (
        <section className="home__section">
          <div className="home__head">
            <h2 className="home__title">What people buy here</h2>
            <p className="home__blurb tg-muted">
              Every unit is one of one, so this counts models, not items.
            </p>
          </div>
          <ol className="home__models">
            {d.topModels.map((m) => (
              <li key={`${m.brandName}-${m.modelName}`} className="model">
                <div className="model__name">
                  <span className="tg-muted">{m.brandName}</span> {m.modelName}
                </div>
                <div className="model__stat">
                  <strong>{m.soldCount}</strong> sold
                </div>
                {m.liveCount > 0 ? (
                  <Link
                    className="model__cta"
                    to={`/catalog?q=${encodeURIComponent(m.modelName)}`}
                  >
                    {m.liveCount} available{m.fromPriceMinor != null && ` from ${money(m.fromPriceMinor)}`} →
                  </Link>
                ) : (
                  <span className="model__gone tg-muted">None in stock</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {d.wanted.length > 0 && (
        <section className="home__section home__wanted">
          <div className="home__head">
            <h2 className="home__title">Buyers are looking for</h2>
            <p className="home__blurb tg-muted">
              Open asks on the Wanted board. If one of these is sitting in your cupboard,
              it already has a buyer.
            </p>
          </div>
          <ul className="home__asks">
            {d.wanted.map((w) => (
              <li key={w.id} className="ask">
                <span className="ask__what">{w.wanted}</span>
                <span className="ask__terms tg-muted">
                  {w.minGradeCode && `${w.minGradeCode} or better`}
                  {w.minGradeCode && w.maxPriceMinor != null && ' · '}
                  {w.maxPriceMinor != null && `up to ${money(w.maxPriceMinor)}`}
                </span>
              </li>
            ))}
          </ul>
          <div className="home__wanted-actions">
            <Link to="/wanted" className="tg-button">See the whole board</Link>
            <Link to="/sell" className="tg-button tg-button--primary">Sell your gear</Link>
          </div>
        </section>
      )}
    </div>
  )
}

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
      <ol className="rail">{children}</ol>
    </section>
  )
}

function GearCard({ listing, showSaving }: { listing: HomeListing; showSaving?: boolean }) {
  const name = listing.title.split('·')[0].trim()
  return (
    <li className="card">
      <Link to={`/listings/${listing.id}`} className="card__link">
        <Cover cover={listing.cover} categorySlug={listing.categorySlug} alt={name} modelSlug={listing.modelSlug} />
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
        <span className="card__saving">
          {money(listing.savedMinor)} less than new
          {listing.savedPct != null && <span className="tg-muted"> ({listing.savedPct}% off)</span>}
        </span>
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
        <span className="card__name">{name}</span>
      </Link>
      <span className="card__grade">
        <GradeBadge code={sale.gradeCode} />
        {sale.gradeLabel && <span className="tg-muted">{sale.gradeLabel}</span>}
      </span>
      <strong className="card__price">{money(sale.priceMinor)}</strong>
      {sale.soldAt && <span className="card__saving">Sold {relative(sale.soldAt)}</span>}
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

/** A way in rather than a thing to buy: a label and how much sits behind it. */
function Tile({ to, label, count }: { to: string; label: string; count: number }) {
  return (
    <li className="tile">
      <Link to={to} className="tile__link">
        <span className="tile__label">{label}</span>
        <span className="tile__count tg-muted">
          {count} {count === 1 ? 'piece' : 'pieces'}
        </span>
      </Link>
    </li>
  )
}
