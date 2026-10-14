import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const inputDir = resolve(root, 'docs/legal')
const outputDir = resolve(root, 'public/pr')
const documents = [
  { input: 'PRIVACY_POLICY.md', output: 'privacy.html', title: 'プライバシーポリシー' },
  { input: 'TERMS_OF_SERVICE.md', output: 'terms.html', title: '利用規約' },
]

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function safeHref(value) {
  const trimmed = value.trim()
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? trimmed : null
}

function renderInline(source) {
  const tokens = []
  const stash = (html) => `\u0000${tokens.push(html) - 1}\u0000`
  let text = source.replace(/`([^`]+)`/g, (_match, code) => stash(`<code>${escapeHtml(code)}</code>`))
  text = text.replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g, (_match, label, rawHref, title = '') => {
    const href = safeHref(rawHref)
    if (!href) return stash(escapeHtml(label))
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
    return stash(`<a href="${escapeHtml(href)}"${titleAttr}>${escapeHtml(label)}</a>`)
  })
  text = escapeHtml(text).replace(/\u0000(\d+)\u0000/g, (_match, index) => tokens[Number(index)])
  return text
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const html = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) { index += 1; continue }

    const heading = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (heading) {
      const level = heading[1].length
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      index += 1
      continue
    }

    if (index + 1 < lines.length && line.includes('|') && isTableSeparator(lines[index + 1])) {
      const headers = splitTableRow(line)
      index += 2
      const rows = []
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitTableRow(lines[index]))
        index += 1
      }
      html.push('<div class="table-scroll" role="region" tabindex="0" aria-label="横にスクロールできる表"><table><thead><tr>')
      html.push(headers.map((cell) => `<th scope="col">${renderInline(cell)}</th>`).join(''))
      html.push('</tr></thead><tbody>')
      for (const row of rows) {
        html.push('<tr>')
        headers.forEach((_header, cellIndex) => html.push(`<td>${renderInline(row[cellIndex] ?? '')}</td>`))
        html.push('</tr>')
      }
      html.push('</tbody></table></div>')
      continue
    }

    const bullet = /^\s*[-*+]\s+/.test(line)
    if (bullet) {
      const items = []
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, ''))
        index += 1
      }
      html.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`)
      continue
    }

    const paragraph = []
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+/.test(lines[index]) && !/^\s*[-*+]\s+/.test(lines[index]) && !(index + 1 < lines.length && lines[index].includes('|') && isTableSeparator(lines[index + 1]))) {
      const hardBreak = / {2,}$/.test(lines[index])
      paragraph.push({ text: lines[index].replace(/\s+$/, ''), hardBreak })
      index += 1
    }
    html.push(`<p>${paragraph.map((part, partIndex) => `${renderInline(part.text)}${part.hardBreak && partIndex < paragraph.length - 1 ? '<br>' : partIndex < paragraph.length - 1 ? ' ' : ''}`).join('')}</p>`)
  }

  return html.join('\n')
}

function page(document, body) {
  const canonical = `https://app.kakeibodata.com/pr/${document.output}`
  const nav = `<a href="./privacy.html"${document.output === 'privacy.html' ? ' aria-current="page"' : ''}>プライバシーポリシー</a><a href="./terms.html"${document.output === 'terms.html' ? ' aria-current="page"' : ''}>利用規約</a>`
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="description" content="Kakeibowの${escapeHtml(document.title)}です。" />
  <title>${escapeHtml(document.title)}｜Kakeibow</title>
  <link rel="canonical" href="${canonical}" />
  <link rel="stylesheet" href="./legal.css" />
</head>
<body>
  <a class="skip-link" href="#main">本文へ移動</a>
  <header class="site-header"><a class="brand" href="./index.html">Kakeibow</a><span>家計簿サービス</span></header>
  <nav class="legal-nav" aria-label="関連文書">${nav}</nav>
  <main id="main" class="document">${body}</main>
  <footer class="site-footer"><a href="./index.html">紹介ページへ戻る</a><span>© 2026 Kakeibow</span></footer>
</body>
</html>
`
}

await mkdir(outputDir, { recursive: true })
for (const document of documents) {
  const markdown = await readFile(resolve(inputDir, document.input), 'utf8')
  const output = page(document, renderMarkdown(markdown))
  await writeFile(resolve(outputDir, document.output), output, 'utf8')
  console.log(`Generated public/pr/${document.output}`)
}
