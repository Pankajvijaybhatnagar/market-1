import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
      process.env.VITE_API_BASE_URL || 'https://www.nseindia.com'
    ),
  },

  server: {
    proxy: {
      '/api': {
        target: 'https://www.nseindia.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})