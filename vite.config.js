import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 개발 서버(npm run dev)에서도 /api/* 서버리스 함수를 쓸 수 있게 해 준다 (배포에서는 Vercel이 처리).
// .env.local의 GEMINI_API_KEY 등 서버용 값은 VITE_ 접두사가 없어서 브라우저 코드에는 들어가지 않는다.
function localApi(env) {
  return {
    name: 'local-api',
    configureServer(server) {
      for (const [k, v] of Object.entries(env)) if (process.env[k] == null) process.env[k] = v
      server.middlewares.use('/api', async (req, res) => {
        try {
          const name = (req.url || '').split('?')[0].replace(/^\/+/, '')
          if (!/^[a-z0-9-]+$/i.test(name)) {
            res.statusCode = 404
            return res.end()
          }
          const chunks = []
          for await (const c of req) chunks.push(c)
          const raw = Buffer.concat(chunks).toString('utf8')
          try {
            req.body = raw ? JSON.parse(raw) : {}
          } catch {
            req.body = null
          }
          res.status = code => {
            res.statusCode = code
            return res
          }
          res.json = obj => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(obj))
          }
          const mod = await server.ssrLoadModule(`/api/${name}.js`)
          await mod.default(req, res)
        } catch (e) {
          console.error('[local-api]', e)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: '로컬 API 오류' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  server: {
    port: 5190,
    strictPort: true,
    host: true,
  },
  plugins: [
    react(),
    localApi(loadEnv(mode, process.cwd(), '')),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: '운동 트레이닝',
        short_name: '트레이닝',
        description: '운동 기록·루틴 관리 및 AI 추천',
        theme_color: '#4b89ff',
        background_color: '#f5f7fa',
        display: 'standalone',
        start_url: '/mobile',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
}))
