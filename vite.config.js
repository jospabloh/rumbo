import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { configDefaults } from 'vitest/config'
import { defineConfig } from 'vite'

// Bake the Base44 app id into the client bundle so the app authenticates on ANY
// host. On the native *.base44.app domain Base44 injects ?app_id, but custom
// domains (e.g. rumbo.acaciaco.com.mx) don't — without this the client boots with
// app_id=null and the login redirect fails. Source of truth is base44/.app.jsonc
// (committed); an explicit VITE_BASE44_APP_ID env still wins.
if (!process.env.VITE_BASE44_APP_ID) {
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, './base44/.app.jsonc'), 'utf8').replace(/\/\/.*$/gm, '')
    const id = JSON.parse(raw)?.id
    if (id) process.env.VITE_BASE44_APP_ID = id
  } catch { /* fall back to Base44's runtime injection */ }
}

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // jsdom provides window/document, needed because some lib modules transitively
    // import the base44 client (which reads window.location at import time).
    environment: 'jsdom',
    globals: true,
    // tests/smoke/ is a Playwright suite that drives a real browser against the
    // DEPLOYED site (`npm run test:smoke`). Vitest's default glob picks up its
    // *.spec.js and dies importing Playwright's `test.describe`, so it is
    // excluded here rather than renamed — the name matches the rest of the
    // portfolio's copies of that suite.
    exclude: [...configDefaults.exclude, 'tests/smoke/**'],
  },
});