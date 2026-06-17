import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['aurea-mark.png', 'aurea-splash.png'],
      manifest: {
        name: 'Aurea',
        short_name: 'Aurea',
        description: 'Aurea - a local-first travel journal and planner.',
        theme_color: '#40171A',
        background_color: '#40171A',
        icons: [
          {
            src: 'aurea-mark.png',
            sizes: '1254x1254',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
  }
})
