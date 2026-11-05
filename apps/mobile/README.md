# TrueGlaz mobile

The TrueGlaz buyer & seller app for **iOS and Android**, built with **React Native + Expo**.
It talks to the same TrueGlaz API as the web app and is scoped to the two end-user
journeys — **buying** and **selling**.

## What's in it

- **Auth** — passwordless OTP sign-in (email → one-time code) + sign-up for new accounts.
- **Buyer** — home, searchable catalogue (IndiaMart-style cards: image, spec rows, trust
  line, Buy now / View details), product detail, buy → reserve → checkout → order
  tracking, accept delivery, request a return.
- **Seller** — Aadhaar eKYC, a clear "awaiting TrueGlaz approval" gate, submissions
  (create / add item / submit), per-item lifecycle timeline, and the accept / counter /
  decline price decision. Dashboard of amounts owed and paid out.
- **Notifications** — an in-app feed (`🔔` on Profile) with mark-read / mark-all-read, and
  an unread badge on the Profile tab.
- **Profile** — account details, light/dark/midnight theme, sign out.

## Architecture

- `@trueglaz/core` — the shared, platform-agnostic API client, types and hooks, from
  `packages/core` in this monorepo (the same code the website uses). Two platform pieces
  stay in the app: `App.tsx` installs an AsyncStorage adapter for core's storage port, and
  `src/media/uploadPhoto.ts` turns a phone photo (often HEIC) into a JPEG before
  `api.uploadMedia` sends it. `metro.config.js` makes Metro resolve core and keep a single
  React (the app's 18.2, not the website's 18.3).
- `src/screens/` — one file per screen; navigation is wired in `App.tsx` (bottom tabs:
  Home / Shop / Sell / Orders / Profile, plus a root stack for detail screens).
- `src/components/`, `src/theme/` — the UI kit, form kit, Timeline, and theme context;
  palette tokens live in `packages/core/src/theme/tokens.ts` (shared with web).

## Running it

From the repository root (one `npm install` for web, mobile and core):

```bash
npm install
npm run mobile     # Expo dev server — scan the QR with Expo Go, or press i / a
npm run typecheck  # core + web + mobile
```

The API it points at is `expo.extra.apiOrigin` in `app.json` (the demo box). Override:

```bash
EXPO_PUBLIC_API_ORIGIN="http://<api-host>" npm run mobile
```

On a physical device the API must be reachable from the phone — a laptop-hosted API needs
the laptop's LAN address, not `localhost`.

## Demo sign-in

The demo server shows the one-time code on screen. Sign in with any email; for a
ready-made seller, use `seller@trueglaz.demo`.
