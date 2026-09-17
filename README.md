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

## Run it

The API has to be running first (`./gradlew bootRun` in trueglaz-api, on :8080).

```bash
npm install

npm run dev      # web on http://localhost:5173
npm run mobile   # Expo — scan the QR with Expo Go, or press w/i/a
npm run build    # regenerates tokens, then builds the web app
npm run typecheck
```

On a phone the app cannot reach your machine's `localhost`. Set the LAN address:

```bash
EXPO_PUBLIC_API_ORIGIN=http://192.168.1.50:8080 npm run mobile
```

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
| `ActorContext.tsx` | Who the app is acting as |
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

## Acting as

The API has no authentication — no login, no sessions, no account endpoints. It
identifies callers from headers:

```
X-Actor-Id: <user uuid>    X-Actor-Role: User | Staff | Technician | Admin | System
```

Both apps pick a seeded user from `GET /dev/actors`. This is a stand-in, not a
login: roles are self-declared and the API believes them.

**This is the thing to fix before shipping mobile.** On web it is a localhost
demo. A published binary where identity is a self-declared header is a different
matter — anyone can proxy the traffic and become an admin. When OTP and sessions
land, only `ActorContext.tsx` and `authHeaders` in `client.ts` change.

## Two API gaps

**1. CORS.** The API sets no CORS headers. Web works around it with a Vite
proxy; **native does not need it at all**, having no same-origin policy. In
production either serve web from one origin or add a CORS policy.

**2. Listings carry no model reference.** `GET /listings` returns a generated
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
