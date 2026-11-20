import { legalMoves } from './legality'
import { countKinds, isSuited, rankOf, type Kind } from './tiles'
import type { GameState, Move, Seat } from './types'

/** How much a tile is worth keeping: copies first, then neighbours it could run with. */
function keepValue(c: number[], k: Kind): number {
  const v = (c[k] - 1) * 6
  if (!isSuited(k)) return v - 0.5
  const r = rankOf(k)
  let near = 0
  if (r > 0 && c[k - 1]) near += 3
  if (r < 8 && c[k + 1]) near += 3
  if (r > 1 && c[k - 2]) near += 1
  if (r < 7 && c[k + 2]) near += 1
  return v + near + 0.1 * Math.min(r, 8 - r)
}

/**
 * The bot's move: a pure function of the state, so every client computes the
 * same one and bots never need the network.
 */
export function botMove(state: GameState, seat: Seat): Move {
  const moves = legalMoves(state, seat).filter((m) => m.type !== 'resume' && m.type !== 'takeover')
  const pick = (type: Move['type']) => moves.find((m) => m.type === type)
  const hu = pick('hu')
  if (hu) return hu
  const gang = pick('gang')
  if (gang) return gang
  const c = countKinds(state.hands[seat])

  if (state.phase === 'claim') {
    const kind = state.pending!.kind
    const pairs = c.filter((n) => n >= 2).length
    const chasingPairs = state.melds[seat].length === 0 && pairs >= 5
    const peng = pick('peng')
    if (peng && !chasingPairs) return peng
    // 吃 only with two loose tiles, and only if the run is not already made in hand
    const chi = moves.find((m) => m.type === 'chi' && c[m.use[0]] === 1 && c[m.use[1]] === 1 && c[kind] === 0)
    if (chi && !chasingPairs) return chi
    return { type: 'pass' }
  }

  let best: Kind = -1
  let low = Infinity
  for (const m of moves) {
    if (m.type !== 'discard') continue
    const v = keepValue(c, m.kind)
    if (v < low) {
      low = v
      best = m.kind
    }
  }
  return { type: 'discard', kind: best }
}
