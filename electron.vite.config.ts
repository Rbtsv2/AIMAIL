// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

// .env (local) ou variables d'environnement (CI) : incorporées dans le bundle main, car un .env n'existe pas chez l'utilisateur
function loadDotEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
  return out
}
const env = { ...loadDotEnv(), ...process.env }
const baked = (k: string) => JSON.stringify(env[k] ?? '')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: { __GOOGLE_CLIENT_ID__: baked('GOOGLE_CLIENT_ID'), __GOOGLE_CLIENT_SECRET__: baked('GOOGLE_CLIENT_SECRET'), __MS_CLIENT_ID__: baked('MS_CLIENT_ID') },
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    }
  }
})