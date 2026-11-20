import type { Kind } from './tiles'

export type Seat = number
export const SEATS = 4

export interface GameConfig {
  /** Four names; seats `humans..3` are bots. */
  names: string[]
  /** Humans sit at seats 0..humans-1 (the network seats); the rest are bots. */
  humans: number
  sharedSeed: number
  startingDealer: Seat
  /** The session ends after this many hands. */
  maxHands: number
  /** Cash per point (0 = free play) and the point cap that sets the buy-in. */
  pointValue: number
  capPoints: number
  rulesVersion: string
}

export interface Meld {
  type: 'chi' | 'peng' | 'gang'
  kinds: Kind[]
  /** Whose discard completed it; null for a concealed gang. */
  from: Seat | null
  concealed: boolean
}

export type Move =
  | { type: 'discard'; kind: Kind }
  /** Claim the discard with these two tiles from hand. */
  | { type: 'chi'; use: [Kind, Kind] }
  | { type: 'peng' }
  /** On a discard: 明杠. On your own turn: 暗杠 (four in hand) or 补杠 (added to a 碰). */
  | { type: 'gang'; kind: Kind }
  /** 自摸 on your own turn, or win on the pending discard / robbed 杠. */
  | { type: 'hu' }
  | { type: 'pass' }
  | { type: 'nextHand' }
  /** Hand an absent player's seat to the bot. */
  | { type: 'takeover'; seat: Seat }
  /** Take my seat back from the bot. */
  | { type: 'resume' }

/** A discard (or a 补杠 being robbed) that seats are being asked about, one at a time. */
export interface Pending {
  kind: Kind
  from: Seat
  /** True when this is a 补杠 that may only be answered with 胡. */
  rob: boolean
  /** Seats still to ask, in asking order; the head is `toAct`. */
  queue: Seat[]
  best: { seat: Seat; move: Move; rank: number } | null
}

export interface HandResult {
  handIndex: number
  winner: Seat | null
  how: 'zimo' | 'ron' | 'rob' | 'draw'
  /** Who paid for a 点炮 / 抢杠. */
  from: Seat | null
  tile: Kind | null
  /** Points won or lost this hand per seat (sums to zero). */
  delta: number[]
}

export type Phase = 'turn' | 'claim' | 'handOver' | 'over'

export interface GameState {
  config: GameConfig
  /** Serializable rng state for the per-hand shuffle. */
  rng: number
  handIndex: number
  dealer: Seat
  /** Drawn from the end. */
  wall: Kind[]
  /** Concealed tiles per seat, sorted; includes the drawn tile on your turn. */
  hands: Kind[][]
  melds: Meld[][]
  discards: Kind[][]
  /** The tile `toAct` just drew (display only). */
  drawn: Kind | null
  /** After 吃/碰 the only move is a discard. */
  mustDiscard: boolean
  phase: Phase
  toAct: Seat
  pending: Pending | null
  scores: number[]
  /** 杠 payments this hand; they stand only if the hand is won. */
  gangDelta: number[]
  /** Human seats currently played by the bot. */
  autopilot: boolean[]
  /** The latest table action, for display and sound. */
  last: { seat: Seat; type: Move['type'] | 'draw'; kind: Kind | null } | null
  lastHand: HandResult | null
  result: { points: number[] } | null
}
