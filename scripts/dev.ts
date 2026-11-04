// scripts/dev.ts — lance electron-vite dev en filtrant le bruit des pilotes graphiques (GBM/NVIDIA, Mesa, GLib)
// Exécuté avec Node ≥ 22.6 (--experimental-strip-types), sans dépendance supplémentaire.
import { spawn } from 'node:child_process'
import type { Writable } from 'node:stream'

const NOISE: RegExp[] = [
  /GBM-DRV error/i,
  /gbm_drv_common\.c/i,
  /GLib-GObject.*has no handler with id/i,
  /Add chromium\/from-privileged to kAtomsToCache/i,
  /atom_cache\.cc/i
]

const bin = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const child = spawn(bin, ['electron-vite', 'dev', ...process.argv.slice(2)], { env: process.env, stdio: ['inherit', 'pipe', 'pipe'] })

let lastBlank = false
function filter(chunk: Buffer, out: Writable): void {
  for (const line of chunk.toString().split('\n')) {
    if (NOISE.some((r) => r.test(line))) continue
    const blank = line.trim() === ''
    if (blank && lastBlank) continue   // pas de lignes vides en rafale après filtrage
    lastBlank = blank
    out.write(line + '\n')
  }
}

child.stdout?.on('data', (c: Buffer) => filter(c, process.stdout))
child.stderr?.on('data', (c: Buffer) => filter(c, process.stderr))
child.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => child.kill(sig))