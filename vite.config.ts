import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 開発時は API を自宅サーバーへ転送（本番は同一オリジンなので不要）
    proxy: {
      '/auth': 'http://localhost:8000',
      '/sync': 'http://localhost:8000',
      '/users': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
