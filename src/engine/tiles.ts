/** A tile kind, 0..33: 万 0–8, 筒 9–17, 条 18–26, 东南西北 27–30, 中发白 31–33. Four copies of each. */
export type Kind = number

export const KINDS = 34
/** A face-down tile in a redacted view. */
export const HIDDEN: Kind = -1

export const isSuited = (k: Kind): boolean => k >= 0 && k < 27
/** 0 万, 1 筒, 2 条, 3 honors. */
export const suitOf = (k: Kind): number => (k < 27 ? Math.floor(k / 9) : 3)
/** 0-based rank within the suit (0–8), or 0–6 for honors. */
export const rankOf = (k: Kind): number => (k < 27 ? k % 9 : k - 27)

const SUIT = ['Characters', 'Dots', 'Bamboo']
const HONOR = ['East', 'South', 'West', 'North', 'Red', 'Green', 'White']
/** English name for labels and status lines, e.g. "3 Bamboo", "East", "Red". */
export const kindName = (k: Kind): string => (k < 0 ? '?' : k < 27 ? `${(k % 9) + 1} ${SUIT[Math.floor(k / 9)]}` : HONOR[k - 27])

/** The 136-tile set, in kind order. */
export function fullSet(): Kind[] {
  const out: Kind[] = []
  for (let k = 0; k < KINDS; k++) out.push(k, k, k, k)
  return out
}

export function countKinds(tiles: readonly Kind[]): number[] {
  const c = new Array<number>(KINDS).fill(0)
  for (const t of tiles) if (t >= 0) c[t]++
  return c
}

export const sortTiles = (tiles: Kind[]): Kind[] => tiles.sort((a, b) => a - b)

/** Remove `n` copies of `kind` from `tiles` in place; throws if they are not there. */
export function removeTiles(tiles: Kind[], kind: Kind, n = 1): void {
  for (let i = 0; i < n; i++) {
    const at = tiles.indexOf(kind)
    if (at < 0) throw new Error(`tile ${kind} not in hand`)
    tiles.splice(at, 1)
  }
}
