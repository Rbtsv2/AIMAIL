const ts = () => new Date().toISOString().slice(11, 23)
export const log = {
  info: (scope: string, ...a: unknown[]) => console.log(`[${ts()}] [${scope}]`, ...a),
  warn: (scope: string, ...a: unknown[]) => console.warn(`[${ts()}] [${scope}]`, ...a),
  error: (scope: string, ...a: unknown[]) => console.error(`[${ts()}] [${scope}]`, ...a)
}
