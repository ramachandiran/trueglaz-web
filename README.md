# TrueGlaz Web

Frontend for the TrueGlaz consignment marketplace. Talks to the
[trueglaz-api](https://github.com/ramachandiran/trueglaz-api) — this is a
separate project and shares no code with it.

React 18 · TypeScript · Vite · plain CSS with design tokens. No UI framework,
deliberately: the theme is meant to be replaced, and component libraries make
that harder rather than easier.

## Run it

The API has to be running first (`./gradlew bootRun` in trueglaz-api, on :8080).

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. Pick an actor from the header dropdown — the API
has no login yet, so the app states who it is on every call (see *Acting as*
below).

```bash
npm run build       # typecheck + production bundle into dist/
npm run typecheck   # types only
```

## What's in it

| Route | What it does |
|---|---|
| `/` | Catalogue. Left sidebar filters, card grid. |
| `/listings/:id` | One listing: grade, disclosed defects, price history, lifecycle. |
| `/items` | Tracking view. Every unit by lifecycle stage. |
| `/items/:id` | One unit: the timeline, what can happen next, full history. |

### Filters

Down the left of the catalogue: search, sort, type (cameras/lenses), brand,
condition grade and a price range. Every facet shows a live count computed
against whatever else is selected, so a count of zero genuinely means "picking
this shows nothing" — those options are disabled rather than hidden, so the list
does not jump around as you filter.

### The lifecycle timeline

Each item gets its journey as one line: completed stages filled and dated,
the current stage highlighted, and what is still ahead greyed out.

It is built from the item's append-only `item_state_transition` history rather
than from `current_state`, so it shows what actually happened. Two details worth
knowing:

- **It does not lie about the future.** An item that goes off the happy path —
  quarantined, declined, returned — stops projecting the rest of the sale route.
  The upcoming stages become the item's real legal next moves, taken from
  `nextLegalStates`. A quarantined lens shows `Archived` as its only exit, not a
  fictional path to `Accepted`.
- **Detours are shown, not hidden.** Anything that happened but is not on the
  happy path appears inline in amber, with its reason code.

The canonical path lives in `src/lib/lifecycle.ts` as `HAPPY_PATH`.

## Replacing the theme

**Everything is in `src/theme/tokens.css`.** No component hardcodes a colour,
font or radius — they all read semantic tokens like `--tg-bg`, `--tg-accent`,
`--tg-step-done`.

To retheme:

1. Copy `tokens.css`, change the **values**, keep every token **name**.
2. Point `src/theme/index.css` at your file.

That is the whole procedure. `src/theme/themes/midnight.css` is a worked example
— warm paper, violet accent, serif type, tighter corners — that changes the
entire app while touching nothing else. Swap the import in `index.css` to see it.

Tokens come in two layers. Primitives (`--tg-c-*`) are a raw palette; semantic
roles (`--tg-bg`, `--tg-accent`, …) are what components use. Most rethemes only
need the primitives. The timeline has its own `--tg-step-*` roles so the
lifecycle graph can be recoloured independently.

Dark mode follows the system by default and can be overridden from the header;
a replacement theme inherits that toggle for free.

## Acting as

The API has no authentication — no login, no sessions, no account endpoints.
It identifies the caller from two headers:

```
X-Actor-Id: <user uuid>
X-Actor-Role: User | Staff | Technician | Admin | System
```

The header dropdown picks one of the seeded users from `GET /dev/actors`. This
is a stand-in, not a login: roles are self-declared and the API believes them.
When OTP and sessions land, only `src/state/ActorContext.tsx` and `authHeaders`
in `src/api/client.ts` need to change.

## Two things the API needs

Both are worked around here; neither workaround belongs in production.

**1. CORS.** The API sets no CORS headers, so a browser on another origin is
blocked outright. In development Vite proxies `/api` to `:8080`, which sidesteps
it. In production either serve both from one origin or add a CORS policy on the
API.

**2. Listings carry no model reference.** `GET /listings` returns a generated
title but no `productModelId`, `brandId` or `categoryId`, and the endpoint only
filters on text, a single grade and a price ceiling. So brand and category
faceting is resolved in the browser by matching the title against the catalogue
(`ListingService.publishRow` builds it as `"{model name} · {grade}"`), and the
remaining facets are applied client-side over a large page.

That works for a catalogue this size and is honest about what it is, but it is
guesswork and it will not scale. Exposing `productModelId` on the listing
payload and accepting brand/category/multi-grade filters server-side would
remove it entirely. See `src/lib/filters.ts`.

## Layout

```
src/
  api/        client (fetch + actor headers), response types, useApi hook
  components/ AppShell, FilterSidebar, Timeline, shared UI
  lib/        lifecycle (the timeline logic), filters (faceting), format
  pages/      Catalog, ListingDetail, Items, ItemDetail
  state/      ActorContext (stands in for auth), useTheme
  theme/      tokens.css  <- the theme, base.css, themes/midnight.css
```
