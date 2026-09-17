import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API sets no CORS headers, so in development the browser talks to Vite and
// Vite talks to the API. In production either serve both from one origin or add
// a CORS policy on the API side.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_ORIGIN ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
