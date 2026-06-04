import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_PROXY_TARGET || 'https://localhost/glpi/public'

  return {
    plugins: [react()],
    server: {
      proxy: {
        // /api/... (côté client) -> {GLPI}/api.php/... (serveur)
        '/api': {
          target,
          changeOrigin: true,
          secure: false, // certificat HTTPS auto-signé en local
          rewrite: (path) => path.replace(/^\/api/, '/api.php'),
        },
      },
    },
  }
})
