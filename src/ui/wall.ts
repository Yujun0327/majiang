/**
 * The wall as a picture. The engine only keeps `state.wall` (a list drawn
 * from the end); this derives where those tiles sit on the table: 68 stacks
 * of two, 17 in front of each seat, opened where the dealer's dice say and
 * taken clockwise from there. Display only — nothing here affects play.
 */
import { SEATS, type GameState, type Seat } from '../engine'

export const PER_SIDE = 17
export const STACKS = PER_SIDE * SEATS
export const TILES = STACKS * 2

export interface Opening {
  dice: [number, number]
  total: number
  /** The seat whose side of the wall is opened. */
  side: Seat
}

/**
 * The dealer's roll. `state.rng` is fixed for the whole hand and identical on
 * every client, so everyone sees the same dice without any extra messages.
 */
export function openingOf(state: Pick<GameState, 'rng' | 'dealer'>): Opening {
  const r = state.rng >>> 0
  const dice: [number, number] = [1 + (r % 6), 1 + ((r >>> 9) % 6)]
  const total = dice[0] + dice[1]
  // count the total round the table from the dealer (dealer = 1), in playing order
  return { dice, total, side: (state.dealer + total - 1) % SEATS }
}

/**
 * Draw order of the stack at `pos` (0 = left end, 16 = right end, as its own
 * seat sees it) on `seat`'s side: 0 is the first stack taken. The opening is
 * `total` stacks in from the right end of the opened side; tiles are taken
 * leftward from there and on round the table, clockwise.
 */
export function orderOf(open: Opening, seat: Seat, pos: number): number {
  const clockwise = ((open.side - seat + SEATS) % SEATS) * PER_SIDE + (PER_SIDE - 1 - pos)
  return (clockwise - open.total + STACKS) % STACKS
}

/** Tiles left in stack `order` once `drawn` tiles have left the wall: 2, 1 or 0. */
export function levelOf(drawn: number, order: number): number {
  return 2 - Math.max(0, Math.min(2, drawn - order * 2))
}

export const drawnOf = (state: Pick<GameState, 'wall'>): number => TILES - state.wall.length

/** The stack the most recently drawn tile came from. */
export const stackOfLast = (drawn: number): number => Math.max(0, Math.floor((drawn - 1) / 2))
