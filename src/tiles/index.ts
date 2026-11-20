/**
 * Mahjong tile faces as inline SVG strings (60×80 design space), in the
 * shape of @yujun/hwatu and @yujun/playing-cards so this folder can move
 * to its own package later. Kinds: 万 0–8, 筒 9–17, 条 18–26, 东南西北
 * 27–30, 中发白 31–33; anything negative is a face-down tile.
 */

const INK = '#1c1a17'
const RED = '#b3261e'
const GREEN = '#1f7a4d'
const BLUE = '#1d4e89'
const CJK = `'Songti SC','STSong','Noto Serif CJK SC','Noto Serif SC','Source Han Serif SC','SimSun','PMingLiU',serif`

const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const HONOR = ['東', '南', '西', '北', '中', '發']
const HONOR_INK = [INK, INK, INK, INK, RED, GREEN]

type Pt = [number, number]

const DOTS: { r: number; at: Pt[]; ink: string[] }[] = [
  { r: 15, at: [[30, 40]], ink: [RED] },
  { r: 9.5, at: [[30, 22], [30, 58]], ink: [GREEN, BLUE] },
  { r: 8, at: [[15, 18], [30, 40], [45, 62]], ink: [BLUE, RED, GREEN] },
  { r: 8.5, at: [[18, 23], [42, 23], [18, 57], [42, 57]], ink: [BLUE, GREEN, GREEN, BLUE] },
  { r: 7.5, at: [[16, 20], [44, 20], [30, 40], [16, 60], [44, 60]], ink: [BLUE, GREEN, RED, GREEN, BLUE] },
  { r: 7.5, at: [[18, 17], [42, 17], [18, 42], [42, 42], [18, 63], [42, 63]], ink: [GREEN, GREEN, RED, RED, RED, RED] },
  { r: 6, at: [[14, 13], [30, 21], [46, 29], [19, 48], [41, 48], [19, 66], [41, 66]], ink: [GREEN, GREEN, GREEN, RED, RED, RED, RED] },
  { r: 6.4, at: [[18, 13], [42, 13], [18, 31], [42, 31], [18, 49], [42, 49], [18, 67], [42, 67]], ink: [BLUE] },
  { r: 6.6, at: [[14, 18], [30, 18], [46, 18], [14, 40], [30, 40], [46, 40], [14, 62], [30, 62], [46, 62]], ink: [BLUE, BLUE, BLUE, RED, RED, RED, GREEN, GREEN, GREEN] },
]

/** Bamboo sticks: [x, y, red?]. */
const STICKS: { h: number; at: [number, number, boolean?][] }[] = [
  { h: 46, at: [[30, 40, true]] },
  { h: 24, at: [[30, 23], [30, 57]] },
  { h: 24, at: [[30, 22], [18, 58], [42, 58]] },
  { h: 24, at: [[18, 23], [42, 23], [18, 57], [42, 57]] },
  { h: 22, at: [[16, 22], [44, 22], [30, 40, true], [16, 58], [44, 58]] },
  { h: 24, at: [[15, 23], [30, 23], [45, 23], [15, 57], [30, 57], [45, 57]] },
  { h: 18, at: [[30, 14, true], [15, 39], [30, 39], [45, 39], [15, 63], [30, 63], [45, 63]] },
  { h: 24, at: [[12, 23], [24, 23], [36, 23], [48, 23], [12, 57], [24, 57], [36, 57], [48, 57]] },
  { h: 18, at: [[15, 15], [30, 15, true], [45, 15], [15, 40], [30, 40, true], [45, 40], [15, 65], [30, 65, true], [45, 65]] },
]

function dot([x, y]: Pt, r: number, ink: string): string {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/><circle cx="${x}" cy="${y}" r="${(r * 0.52).toFixed(1)}" fill="none" stroke="#f6f0e0" stroke-width="${(r * 0.18).toFixed(1)}"/><circle cx="${x}" cy="${y}" r="${(r * 0.16).toFixed(1)}" fill="#f6f0e0"/>`
}

function stick(x: number, y: number, h: number, red: boolean, w: number): string {
  const ink = red ? RED : GREEN
  const top = y - h / 2
  const notch = `stroke="#f6f0e0" stroke-width="1.2"`
  return `<rect x="${x - w / 2}" y="${top}" width="${w}" height="${h}" rx="${w / 2.4}" fill="${ink}"/><path d="M${x - w / 2} ${y - h / 6}h${w}M${x - w / 2} ${y + h / 6}h${w}" ${notch}/>`
}

function text(s: string, y: number, size: number, ink: string): string {
  return `<text x="30" y="${y}" text-anchor="middle" font-family="${CJK}" font-weight="700" font-size="${size}" fill="${ink}">${s}</text>`
}

function face(kind: number): string {
  if (kind < 9) return text(NUM[kind], 33, 30, INK) + text('萬', 70, 32, RED)
  if (kind < 18) {
    const d = DOTS[kind - 9]
    return d.at.map((p, i) => dot(p, d.r, d.ink[i % d.ink.length])).join('')
  }
  if (kind < 27) {
    const s = STICKS[kind - 18]
    const w = s.at.length === 1 ? 12 : s.at.length >= 8 ? 6 : 7
    return s.at.map(([x, y, red]) => stick(x, y, s.h, !!red, w)).join('')
  }
  if (kind === 33) return `<rect x="13" y="15" width="34" height="50" rx="3" fill="none" stroke="${BLUE}" stroke-width="4"/><rect x="19" y="21" width="22" height="38" rx="1.5" fill="none" stroke="${BLUE}" stroke-width="1.5"/>`
  return text(HONOR[kind - 27], 56, 46, HONOR_INK[kind - 27])
}

const cache = new Map<number, string>()

/** One tile as an SVG string; scales to its container's width. */
export function tileSvg(kind: number): string {
  const key = kind < 0 ? -1 : kind
  const hit = cache.get(key)
  if (hit) return hit
  const body =
    key < 0
      ? `<rect x="1" y="1" width="58" height="78" rx="7" fill="#1c6b55" stroke="#0b2f26" stroke-width="2"/><rect x="7" y="7" width="46" height="66" rx="4" fill="none" stroke="rgb(255 255 255 / 0.28)" stroke-width="1.5"/><path d="M30 26l12 14-12 14-12-14z" fill="none" stroke="rgb(255 255 255 / 0.28)" stroke-width="1.5"/>`
      : `<rect x="1" y="1" width="58" height="78" rx="7" fill="#f6f0e0" stroke="#8a7f66" stroke-width="2"/>${face(key)}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80" role="img" aria-hidden="true">${body}</svg>`
  cache.set(key, svg)
  return svg
}
