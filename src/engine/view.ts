import { deepClone } from './clone'
import { HIDDEN } from './tiles'
import type { GameState, Seat } from './types'

/**
 * The viewer's picture of the table: other hands and the wall face down,
 * until the hand is over and every hand is shown.
 *
 * Display-only privacy (honor system): every client derives the full deal
 * from the shared seed, and `publicHash` covers all of it.
 */
export function redact(state: GameState, viewer: Seat | null): GameState {
  const view = deepClone(state)
  const open = view.phase === 'handOver' || view.phase === 'over'
  if (!open) {
    view.hands = view.hands.map((h, seat) => (seat === viewer ? h : h.map(() => HIDDEN)))
    if (view.toAct !== viewer && view.drawn !== null) view.drawn = HIDDEN
  }
  view.wall = view.wall.map(() => HIDDEN)
  return view
}
