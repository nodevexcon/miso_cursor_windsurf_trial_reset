import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import * as path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          // Preload-Scripts build'i tamamlandığında Renderer-Process'e sayfayı yeniden yüklemesini bildirir.
          options.reload()
        },
      }
    ]),
  ],
}) 