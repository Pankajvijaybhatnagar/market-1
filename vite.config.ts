import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/api/option-chain': {
        target: 'https://www.nseindia.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/option-chain/, '/api/option-chain-v3'),
      },
    },
  },
})