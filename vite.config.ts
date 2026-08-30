import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const buildId = Date.now().toString(36)

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  build: {
    rollupOptions: {
      output: {
        // アプリ更新のたびに巨大な共通ライブラリを取り直さないよう分離する
        manualChunks(id) {
          const path = id.replaceAll('\\', '/')
          if (!path.includes('/node_modules/')) return undefined
          if (
            path.includes('/node_modules/react/') ||
            path.includes('/node_modules/react-dom/') ||
            path.includes('/node_modules/react-is/') ||
            path.includes('/node_modules/scheduler/')
          ) return 'react-vendor'
          if (
            path.includes('/node_modules/@mui/') ||
            path.includes('/node_modules/@emotion/')
          ) return 'mui-vendor'
          if (path.includes('/node_modules/dexie/')) return 'storage-vendor'
          return 'vendor'
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 入力中に突然再読込しないよう、新版は画面上で案内してから切り替える
      registerType: 'prompt',
      // Cloudflareに古いsw.jsが残っても、ビルド固有URLで必ず新版を確認する
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '家計簿',
        short_name: '家計簿',
        description: '収入と支出を記録して、割り勘もできる家計簿アプリ',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F2F2F7',
        theme_color: '#F2F2F7',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // アプリ本体（HTML/JS/CSS/アイコン）を端末に保存し、サーバーが止まっていても起動できるようにする
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // 独立したPRページとSNS画像は容量が大きく、アプリ本体のオフライン起動には不要
        globIgnores: ['pr/**/*', 'og.png'],
        // 未知のURLは index.html を返す（SPA）。ただしAPIは除く。
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/(auth|sync|users|ocr|health|docs|openapi\.json)/,
          /^\/pr(?:\/|$)/,
        ],
        // APIはキャッシュせず必ずサーバーへ（データの正はサーバーとIndexedDB）
        runtimeCaching: [
          {
            urlPattern: /^\/(auth|sync|users|ocr|health)/,
            handler: 'NetworkOnly',
          },
        ],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
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
