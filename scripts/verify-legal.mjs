import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const cases = [
  { source: 'PRIVACY_POLICY.md', output: 'privacy.html', canonical: 'https://app.kakeibodata.com/pr/privacy.html' },
  { source: 'TERMS_OF_SERVICE.md', output: 'terms.html', canonical: 'https://app.kakeibodata.com/pr/terms.html' },
]

const generatedBefore = await Promise.all(cases.map((item) => readFile(resolve(root, 'public/pr', item.output))))
const build = spawnSync(process.execPath, [resolve(root, 'scripts/build-legal.mjs')], { cwd: root, encoding: 'utf8' })
assert.equal(build.status, 0, `Build succeeds: ${build.stderr || build.stdout}`)

for (const item of cases) {
  const [markdown, html] = await Promise.all([
    readFile(resolve(root, 'docs/legal', item.source), 'utf8'),
    readFile(resolve(root, 'public/pr', item.output), 'utf8'),
  ])
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${item.output}: exactly one h1`)
  assert(!/<script\b/i.test(html), `${item.output}: no scripts`)
  assert(html.includes(`<link rel="canonical" href="${item.canonical}" />`), `${item.output}: canonical URL`)
  assert(markdown.includes('naitotsubota12@gmail.com') && html.includes('naitotsubota12@gmail.com'), `${item.output}: contact email from source`)
  assert(html.includes('href="./privacy.html"') && html.includes('href="./terms.html"'), `${item.output}: links to both policies`)
  assert(markdown.includes('あきかん') && html.includes('あきかん'), `${item.output}: operator display name comes from the source`)
  assert(!/未承認|確認用案|公開前に確定|\[本人への提示方法|\[採用確認\]/.test(markdown), `${item.source}: no draft or unresolved placeholder wording`)
  assert(!/未承認|確認用案|公開前に確定|\[本人への提示方法|\[採用確認\]/.test(html), `${item.output}: no draft or unresolved placeholder wording`)
  if (item.output === 'terms.html') assert(/無料/.test(markdown) && /運営者が負担/.test(markdown) && /無料/.test(html) && /運営者が負担/.test(html), 'Current fee terms retained')
}

for (let index = 0; index < cases.length; index += 1) {
  const regenerated = await readFile(resolve(root, 'public/pr', cases[index].output))
  assert(generatedBefore[index].equals(regenerated), `${cases[index].output}: generated HTML fully matches the source renderer`)
}

console.log('Legal pages verified: canonical/source links, single h1, no scripts or draft placeholders, operator, email and fee terms.')
