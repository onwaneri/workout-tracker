import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const outDir = path.join(root, 'public', 'icons')
await mkdir(outDir, { recursive: true })

const bg = '#0b0d10'
const accent = '#8b5cf6'

const dumbbell = (size, padding) => {
  const s = size
  const p = padding
  const inner = s - 2 * p
  const barH = inner * 0.18
  const barY = (s - barH) / 2
  const plateW = inner * 0.18
  const plateH = inner * 0.55
  const plateY = (s - plateH) / 2
  const bigW = inner * 0.13
  const bigH = inner * 0.78
  const bigY = (s - bigH) / 2
  const r = inner * 0.06
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${bg}"/>
  <g fill="${accent}">
    <rect x="${p}" y="${bigY}" width="${bigW}" height="${bigH}" rx="${r}"/>
    <rect x="${p + bigW + inner * 0.04}" y="${plateY}" width="${plateW}" height="${plateH}" rx="${r}"/>
    <rect x="${p + bigW + inner * 0.04 + plateW}" y="${barY}" width="${inner - 2 * (bigW + inner * 0.04 + plateW)}" height="${barH}" rx="${r * 0.6}"/>
    <rect x="${s - p - bigW - inner * 0.04 - plateW}" y="${plateY}" width="${plateW}" height="${plateH}" rx="${r}"/>
    <rect x="${s - p - bigW}" y="${bigY}" width="${bigW}" height="${bigH}" rx="${r}"/>
  </g>
</svg>`
}

const pngFromSvg = async (svg, file) => {
  const buf = Buffer.from(svg)
  await sharp(buf).png().toFile(path.join(outDir, file))
  console.log(`wrote ${file}`)
}

await pngFromSvg(dumbbell(192, 24), 'icon-192.png')
await pngFromSvg(dumbbell(512, 64), 'icon-512.png')
await pngFromSvg(dumbbell(512, 102), 'icon-maskable-512.png')
await pngFromSvg(dumbbell(180, 22), 'apple-touch-icon.png')

await writeFile(path.join(outDir, 'icon-source.svg'), dumbbell(512, 64), 'utf8')
console.log('done')
