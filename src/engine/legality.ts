import { countKinds, isSuited, rankOf, type Kind } from './tiles'
import { SEATS, type GameState, type Move, type Pending, type Seat } from './types'
import { isWin } from './win'

/** Bot seats, and human seats handed to the bot. */
export const isBot = (state: GameState, seat: Seat): boolean => seat >= state.config.humans || state.autopilot[seat]

export const rankOfClaim = (move: Move): number => (move.type === 'hu' ? 3 : move.type === 'peng' || move.type === 'gang' ? 2 : move.type === 'chi' ? 1 : 0)

/** Everything `seat` could do with the pending tile, ignoring what others answered. */
export function claimOptions(state: GameState, seat: Seat, pending: Pending): Move[] {
  const { kind, from, rob } = pending
  if (seat === from) return []
  const hand = state.hands[seat]
  const out: Move[] = []
  if (isWin([...hand, kind], state.melds[seat].length)) out.push({ type: 'hu' })
  if (rob) return out
  const c = countKinds(hand)
  if (c[kind] >= 3 && state.wall.length > 0) out.push({ type: 'gang', kind })
  if (c[kind] >= 2) out.push({ type: 'peng' })
  if (seat === (from + 1) % SEATS && isSuited(kind)) {
    const r = rankOf(kind)
    const runs: [number, number][] = [[-2, -1], [-1, 1], [1, 2]]
    for (const [a, b] of runs) {
      if (r + a < 0 || r + b > 8) continue
      if (c[kind + a] > 0 && c[kind + b] > 0) out.push({ type: 'chi', use: [kind + a, kind + b] })
    }
  }
  return out
}

/** The 暗杠 / 补杠 kinds open to the seat on its own turn. */
export function gangKinds(state: GameState, seat: Seat): Kind[] {
  if (state.wall.length === 0) return []
  const c = countKinds(state.hands[seat])
  const out: Kind[] = []
  c.forEach((n, k) => {
    if (n === 4) out.push(k)
    else if (n >= 1 && state.melds[seat].some((m) => m.type === 'peng' && m.kinds[0] === k)) out.push(k)
  })
  return out
}

/** The human who deals the next hand: the next dealer if they are at the table, else the first human who is. */
export function nextHandActor(state: GameState): Seat {
  const present = (s: Seat) => s < state.config.humans && !state.autopilot[s]
  const next = state.lastHand?.winner ?? state.dealer
  if (present(next)) return next
  for (let s = 0; s < state.config.humans; s++) if (present(s)) return s
  return 0
}

export function legalMoves(state: GameState, seat: Seat): Move[] {
  if (state.result) return []
  const out: Move[] = []
  if (state.phase === 'handOver') {
    if (seat === state.toAct) out.push({ type: 'nextHand' })
  } else if (state.phase === 'turn' && seat === state.toAct) {
    const hand = state.hands[seat]
    if (!state.mustDiscard) {
      if (isWin(hand, state.melds[seat].length)) out.push({ type: 'hu' })
      for (const kind of gangKinds(state, seat)) out.push({ type: 'gang', kind })
    }
    for (const kind of new Set(hand)) out.push({ type: 'discard', kind })
  } else if (state.phase === 'claim' && state.pending && seat === state.toAct) {
    const floor = state.pending.best?.rank ?? 0
    for (const m of claimOptions(state, seat, state.pending)) if (rankOfClaim(m) > floor) out.push(m)
    out.push({ type: 'pass' })
  }
  if (seat < state.config.humans) {
    if (state.autopilot[seat]) out.push({ type: 'resume' })
    else for (let t = 0; t < state.config.humans; t++) if (t !== seat && !state.autopilot[t]) out.push({ type: 'takeover', seat: t })
  }
  return out
}

export function sameMove(a: Move, b: Move): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'discard' || a.type === 'gang') return a.kind === (b as typeof a).kind
  if (a.type === 'chi') return a.use[0] === (b as typeof a).use[0] && a.use[1] === (b as typeof a).use[1]
  if (a.type === 'takeover') return a.seat === (b as typeof a).seat
  return true
}
