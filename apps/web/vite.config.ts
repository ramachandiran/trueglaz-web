import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API = process.env.VITE_API_ORIGIN ?? 'http://localhost:8080'

// In development the browser talks to Vite and Vite talks to the API, so the app
// only ever makes same-origin requests and CORS never enters into it. In
// production either serve both from one origin or set CORS_ALLOWED_ORIGINS on
// the API.
export default defineConfig({
  plugins: [react()],
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
