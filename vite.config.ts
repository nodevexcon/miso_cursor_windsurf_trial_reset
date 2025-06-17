import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

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
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete.
          options.reload()
        },
      },
    ]),
  ],
  build: {
    rollupOptions: {
      input: {
        main: 'electron/main.ts',
        preload: 'electron/preload.ts',
        search_worker: 'electron/core/search.worker.ts',
        reset_worker: 'electron/core/reset.worker.ts',
        metadata_worker: 'electron/core/metadata.worker.ts',
        app_cleaner: 'electron/core/app.cleaner.ts'
      }
    }
  }
})