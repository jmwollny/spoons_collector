/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The app fetches the pub data (see src/data.ts) once its JavaScript has
 * run. This adds a preload hint to index.html in builds, so the browser
 * downloads the data alongside the JavaScript rather than after it.
 */
const preloadPubData = (): Plugin => ({
  name: 'preload-pub-data',
  apply: 'build',
  transformIndexHtml(_html, context) {
    const asset = Object.values(context.bundle ?? {}).find(
      (file) => file.type === 'asset' && /spoons_enriched-.*\.json$/.test(file.fileName),
    )
    if (!asset) return []
    return [
      {
        tag: 'link',
        attrs: { rel: 'preload', href: `/${asset.fileName}`, as: 'fetch', crossorigin: '' },
        injectTo: 'head',
      },
    ]
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preloadPubData()],
  build: {
    rolldownOptions: {
      output: {
        // The big libraries in files of their own, so the app's own code
        // stays small and the libraries stay cached when only the app changes
        codeSplitting: {
          groups: [
            { name: 'leaflet', test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet|leaflet\.markercluster|react-leaflet-cluster)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      // Every source file, not just those the tests happen to import
      include: ['src/**/*.{ts,tsx}', 'calc-rarity.js'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/types/**', 'src/**/*.d.ts'],
    },
  },
})
