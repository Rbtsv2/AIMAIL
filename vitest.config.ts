import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
export default defineConfig({ test: { environment: 'node' }, resolve: { alias: { '@shared': resolve('src/shared'), '@': resolve('src/renderer/src') } } })
