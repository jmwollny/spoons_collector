/// <reference types="vitest/config" />
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
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

/**
 * A shareable build loads pub photos from Wetherspoon's site (see
 * src/pubPhoto.ts), so it leaves our own copies in public/images out.
 */
const leaveOutPubPhotos = (outDir: string): Plugin => ({
  name: 'leave-out-pub-photos',
  apply: 'build',
  async closeBundle() {
    await rm(join(outDir, 'images'), { recursive: true, force: true })
  },
})

/**
 * A shareable build also loads pub histories from Wetherspoon's site (see
 * src/pubHistory.ts), so it leaves the history text out of the pub data.
 */
const leaveOutPubHistories = (): Plugin => ({
  name: 'leave-out-pub-histories',
  apply: 'build',
  generateBundle(_options, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type !== 'asset' || !/spoons_enriched-.*\.json$/.test(file.fileName)) continue
      const text = typeof file.source === 'string' ? file.source : new TextDecoder().decode(file.source)
      const pubs = JSON.parse(text) as { history?: string; historyId?: number | null }[]
      const withoutId = pubs.filter((pub) => !pub.historyId).length
      if (withoutId > 0) {
        this.warn(`${withoutId} pubs have no historyId, so show no history (run node history-ids.js)`)
      }
      file.source = JSON.stringify(pubs.map((pub) => ({ ...pub, history: '' })))
    }
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    preloadPubData(),
    ...(loadEnv(mode, process.cwd(), 'VITE_').VITE_PUB_PHOTOS === 'online' || process.env.VITE_PUB_PHOTOS === 'online'
      ? [leaveOutPubPhotos('dist'), leaveOutPubHistories()]
      : []),
  ],
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
}))
