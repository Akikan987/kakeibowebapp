import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
const root = new URL('../', import.meta.url)
const web = new URL('native/mobile/web/', root)
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { cwd: root, stdio: 'inherit' })
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'native', '--outDir', 'native/mobile/web', '--emptyOutDir'], { cwd: root, stdio: 'inherit' })
mkdirSync(web, { recursive: true })
for (const file of ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.ico']) {
  const source = new URL(`public/${file}`, root)
  if (existsSync(source)) cpSync(source, new URL(file, web))
}
if (readdirSync(web).some((name) => /^(sw\.js|pr|downloads|\.well-known)$/u.test(name))) throw new Error('Native bundle must not contain Web distribution or service worker files')
