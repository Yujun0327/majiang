import { KINDS, countKinds, type Kind } from './tiles'

/** Can the remaining counts be split entirely into triplets and runs? */
function allMelds(c: number[]): boolean {
  let i = 0
  while (i < KINDS && c[i] === 0) i++
  if (i === KINDS) return true
  if (c[i] >= 3) {
    c[i] -= 3
    const ok = allMelds(c)
    c[i] += 3
    if (ok) return true
  }
  if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--
    c[i + 1]--
    c[i + 2]--
    const ok = allMelds(c)
    c[i]++
    c[i + 1]++
    c[i + 2]++
    if (ok) return true
  }
  return false
}

/**
 * 推倒胡: the concealed tiles (including the winning one) plus `meldCount`
 * exposed melds make four melds and a pair — or, fully concealed, seven pairs.
 */
export function isWin(hand: readonly Kind[], meldCount: number): boolean {
  if (hand.length !== 14 - 3 * meldCount) return false
  const c = countKinds(hand)
  if (meldCount === 0 && c.every((n) => n % 2 === 0)) return true
  for (let k = 0; k < KINDS; k++) {
    if (c[k] < 2) continue
    c[k] -= 2
    const ok = allMelds(c)
    c[k] += 2
    if (ok) return true
  }
  return false
}

/** The kinds that would complete a hand one tile short of winning. */
export function waits(hand: readonly Kind[], meldCount: number): Kind[] {
  if (hand.length !== 13 - 3 * meldCount) return []
  const out: Kind[] = []
  for (let k = 0; k < KINDS; k++) if (isWin([...hand, k], meldCount)) out.push(k)
  return out
}
