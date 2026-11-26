import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const API = process.env.VITE_API_ORIGIN ?? 'http://localhost:5174'

/**
 * A Content-Security-Policy for the built site (security round 2).
 *
 * The site is served from S3 behind CloudFront, which sends no security headers
 * of its own, so the policy travels in the page. It names every place the site
 * really loads from: itself, Razorpay's checkout (only when someone pays) and
 * the S3 buckets that presigned uploads and private file links point at. Any
 * other script cannot run and nothing can be sent elsewhere — which is what
 * keeps the session token in localStorage out of reach of injected script.
 *
 * Build only: the dev server injects inline scripts for hot reload. A <meta>
 * policy cannot carry frame-ancestors; src/frameGuard.ts covers framing, and
 * deploy/cloudfront-security-headers.js adds the full header set at the edge.
 */
function contentSecurityPolicy(): Plugin {
  const api = process.env.VITE_API_ORIGIN ? ` ${new URL(process.env.VITE_API_ORIGIN).origin}` : ''
  const s3 = 'https://*.amazonaws.com'
  const rzp = 'https://*.razorpay.com'
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${rzp}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${s3}`,
    `media-src 'self' blob: ${s3}`,
    "font-src 'self'",
    `connect-src 'self'${api} ${s3} ${rzp}`,
    `frame-src ${rzp}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${rzp}`,
    'upgrade-insecure-requests',
  ].join('; ')
  return {
    name: 'trueglaz-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }],
  }
}

// In development the browser talks to Vite and Vite talks to the API, so the app
// only ever makes same-origin requests and CORS never enters into it. In
// production either serve both from one origin or set CORS_ALLOWED_ORIGINS on
// the API.
export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  // The phone app (apps/mobile) needs React 19, so npm hoists that copy to the
  // workspace root, where packages/core and react-router would find it. The
  // website is on React 18: always resolve React from this app, or the bundle
  // would hold two Reacts and every hook would throw. tsconfig.json "paths"
  // does the same for the type check.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    port: 5173,

    // Fail rather than quietly moving to 5174.
    //
    // Without this a second `npm run dev` takes the next free port and mentions
    // it in one line of startup output. You then have two copies of the app
    // running, and a tab left open on whichever one you later stopped reports
    // "Could not reach the API" naming a port that has nothing to do with the
    // API. Refusing to start is the kinder failure: it names the real problem
    // at the moment you cause it, rather than twenty minutes later.
    strictPort: true,

    proxy: {
      '/api': {
        target: API,
        changeOrigin: true,
        configure(proxy) {
          // The default is a bare 500, which reads as "the API is broken" when
          // what actually happened is that it was never running.
          proxy.on('error', (err, _req, res) => {
            const code = (err as NodeJS.ErrnoException).code
            const message = code === 'ECONNREFUSED'
              ? `Nothing is listening on ${API}. Start the API, or point VITE_API_ORIGIN somewhere else.`
              : `The API at ${API} dropped the connection (${code ?? err.message}).`
            if ('writeHead' in res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ status: 502, error: 'Bad Gateway', message }))
            } else {
              res.destroy()
            }
          })
        },
      },
    },
  },
})
