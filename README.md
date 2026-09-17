# TrueGlaz Frontend

Web and mobile clients for the TrueGlaz consignment marketplace, sharing one
core. Talks to the [trueglaz-api](https://github.com/ramachandiran/trueglaz-api)
— a separate project, no shared code with it.

```
packages/core     the logic both apps run: API client, types, lifecycle,
                  faceting, formatting — and the theme tokens
apps/web          React 18 + Vite + plain CSS
apps/mobile       React Native (Expo 51) + React Navigation
scripts/          generates the web's CSS variables from the shared tokens
```

## Set it up locally

You need **two repositories** side by side and **two terminals**. Requirements:
Docker (or a JDK 21 + Postgres 16), and Node 18+.

### 1. Start the API

```bash
git clone https://github.com/ramachandiran/trueglaz-api
cd trueglaz-api
git checkout claude/friendly-cray-ilaq8o

docker compose up --build        # Postgres + API on :8080, first build is slow
```

Wait for `Started TrueglazApiApplicationKt`, then in another terminal fill it
with demo data so the app is not empty:

```bash
./scripts/seed-demo.sh
```

### 2. Start the web app

```bash
git clone https://github.com/ramachandiran/trueglaz-web
cd trueglaz-web
git checkout claude/friendly-cray-ilaq8o

npm install
npm run dev                      # http://localhost:5173
```

### 3. Sign in

Open **http://localhost:5173** and sign in with any of these. Type the address,
press **Send code**, and the code appears on screen in a yellow box — **no email
or SMS is sent**, because no provider is wired yet.

| Sign in as | What it unlocks |
|---|---|
| `buyer@trueglaz.demo` | Browse, buy, my orders, accept delivery |
| `seller@trueglaz.demo` | Consign items, price approvals, payouts |
| `technician@trueglaz.demo` | Ops → the inspection bench |
| `qc@trueglaz.demo` | Ops + Fulfilment, QC sign-off, pricing |
| `admin@trueglaz.demo` | Everything, plus Money (payouts and the ledger) |

A route worth walking: buy something as the buyer, dispatch and deliver it as
`qc`, accept it back as the buyer, then look at Money as `admin` — escrow drops,
the seller's payout appears, and every ledger transaction reads *balanced*.

Two things that look like bugs and are not: **QC refuses the technician who
inspected the item** (a database constraint, so inspect as `technician` and sign
off as `qc`), and **the Pay button moves no real money** — there is no gateway
yet, see *Not wired up* below.

### If something does not work

| Symptom | Cause |
|---|---|
| `port 5432 already allocated` | You already run Postgres. Change the db port in `trueglaz-api/docker-compose.yml` to `"5433:5432"` — the API talks to it over the compose network, so nothing else needs changing. |
| No yellow box with a code on sign-in | The API is running without `EXPOSE_DEV_CODE=true`. Compose sets it; a bare `./gradlew bootRun` does not. |
| Sign-in says "Could not reach the API" | The API is not up on :8080, or still starting — the first Docker build takes a few minutes. |
| Catalogue is empty | Run `./scripts/seed-demo.sh` in the API repo. |
| `seed-demo.sh` does nothing | It needs `curl` and `python3` on your PATH. |
| Everything 401s after a while | Sessions last 30 days, but the database is recreated by `docker compose down -v`. Sign in again. |

### Other commands

```bash
npm run build      # regenerates theme tokens, then builds the web app
npm run typecheck  # types across core, web and mobile
npm run mobile     # Expo (see the mobile section)
```

On a phone the app cannot reach your machine's `localhost`. Set the LAN address:

```bash
EXPO_PUBLIC_API_ORIGIN=http://192.168.1.50:8080 npm run mobile
```

## Not wired up

Three things stand between this and a public launch:

- **No payment gateway.** The Pay button calls the capture endpoint directly —
  no redirect, no signature verification, no webhook. A buyer can currently mark
  their own order paid without money moving. This is the one to fix first.
- **No OTP delivery.** Codes are logged and echoed on screen. Production needs
  an SMS or email provider, and `EXPOSE_DEV_CODE` must be off.
- **No automated tests.** Everything has been verified by driving the real app
  in a browser; none of it is repeatable in CI.

## What the two apps share

Everything except presentation. `packages/core` is ~750 lines of platform-free
TypeScript:

| Module | What it is |
|---|---|
| `lifecycle.ts` | The timeline: happy path, detour splicing, terminal detection |
| `filters.ts` | Faceting, counts, sorting |
| `client.ts` | API client, request shaping, error mapping |
| `types.ts` | Response types |
| `useApi.ts` | Fetch-on-mount hook |
| `SessionContext.tsx` | The signed-in session, restored and revalidated on boot |
| `format.ts` | Money, dates, relative times |
| `theme/tokens.ts` | **The theme** |

Both apps call the same `buildTimeline`, so an item's journey is computed once
and drawn twice. Fix a lifecycle rule and both clients get it.

Core touches no browser API. The one that leaked — `localStorage` — is now a
port in `storage.ts`; web supplies a `localStorage` adapter, mobile an
`AsyncStorage` one.

## Replacing the theme

**Everything is `packages/core/src/theme/tokens.ts`.** One file, both platforms.

React Native has no CSS custom properties, so the tokens live as TypeScript and
each platform consumes them its own way:

- **mobile** imports the object through `useTheme()`
- **web** runs `npm run tokens`, which generates
  `apps/web/src/theme/tokens.generated.css`; the stylesheets keep using
  `var(--tg-*)` and hold no colour of their own

To retheme: copy `light`/`dark`, change the **values**, keep every **key**.
`midnight` in the same file is a worked example — warm paper, violet accent,
serif, tighter corners — selectable from the theme switcher in both apps.

Never edit `tokens.generated.css`; it is overwritten.

## The lifecycle timeline

Each item's journey as one line: completed stages dated, the current stage
highlighted, what is ahead greyed out. Horizontal on web, vertical on mobile —
the web app already stacked it below 720px for the same reason.

Built from the append-only `item_state_transition` history rather than
`current_state`, so it shows what actually happened. Two details:

- **It does not lie about the future.** An item that goes off the happy path —
  quarantined, declined, returned — stops projecting the rest of the sale route
  and falls back to its real legal next moves. A quarantined lens shows
  `Archived` as its only exit, not a fictional path to `Accepted`.
- **Detours are shown, not hidden.** Anything off the happy path that actually
  happened appears inline in amber with its reason code.

`HAPPY_PATH` is in `packages/core/src/lifecycle.ts`.

## Signing in

A session is a bearer token from an OTP challenge: request a code for a contact,
exchange it for a token, send the token on every call. `SessionContext` holds it
and revalidates against `/auth/me` on boot rather than trusting what is stored —
it may have expired or been revoked while the tab was closed.

Route guards hide what a role cannot use. That is a courtesy, not a control: the
API enforces the same rules on every call against `user_role`, so editing your
way past a guard gains nothing.

**The web app no longer sends `X-Actor-Role`.** Roles come back from the server
and are only used to decide what to show.

## One API gap left

**Listings carry no model reference.** `GET /listings` returns a generated
title but no `productModelId`/`brandId`/`categoryId`, and filters only on text,
one grade and a price ceiling. Brand and category faceting is resolved in
`filters.ts` by matching the title against the catalogue, with the rest applied
client-side. It works at this size and is honest about being guesswork, but it
will not scale — exposing `productModelId` on the listing payload would remove
it for both clients at once.

## Verification

Web is driven in Chromium against the live API: every route, both timeline
branches, dark mode, mobile width, zero console errors.

Mobile is verified through Expo Web (react-native-web), which renders the real
component tree and the real navigation: catalogue with live data, the filter
sheet with live facet counts, the tracking list, and the timeline reading
"13 of 14 stages" with the same done/current/upcoming split as web. **It has not
been run on a physical device or simulator** — that needs Expo Go and a phone.

There are no automated tests yet. `packages/core/src/lifecycle.ts` is the piece
that most deserves them: pure functions over history, and the place where a
subtle bug would quietly mislead people about where their lens is.
