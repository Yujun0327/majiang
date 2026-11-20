import { shuffleWithState } from './rng'
import { fullSet, sortTiles } from './tiles'
import { SEATS, type GameConfig, type GameState } from './types'

export const BOT_NAMES = ['电脑·东', '电脑·南', '电脑·西', '电脑·北']

export function defaultConfig(over: Partial<GameConfig> = {}): GameConfig {
  const humans = Math.max(1, Math.min(SEATS, over.humans ?? 1))
  const names = Array.from({ length: SEATS }, (_, i) => (i < humans ? over.names?.[i]?.trim() || `玩家${i + 1}` : BOT_NAMES[i]))
  return {
    sharedSeed: 1,
    startingDealer: 0,
    maxHands: 4,
    pointValue: 0,
    capPoints: 50,
    rulesVersion: '1',
    ...over,
    humans,
    names,
  }
}

/** Shuffle, deal thirteen each, and give the dealer the first draw. Mutates `state`. */
export function startHand(state: GameState): void {
  const { deck, state: rng } = shuffleWithState(fullSet(), state.rng)
  state.rng = rng
  state.wall = deck
  state.hands = Array.from({ length: SEATS }, () => sortTiles(state.wall.splice(-13)))
  state.melds = Array.from({ length: SEATS }, () => [])
  state.discards = Array.from({ length: SEATS }, () => [])
  state.gangDelta = new Array<number>(SEATS).fill(0)
  state.pending = null
  state.mustDiscard = false
  const first = state.wall.pop()!
  state.hands[state.dealer].push(first)
  sortTiles(state.hands[state.dealer])
  state.drawn = first
  state.phase = 'turn'
  state.toAct = state.dealer
  state.last = { seat: state.dealer, type: 'draw', kind: null }
}

/** A fresh session with the first hand dealt, before any bot has moved. */
export function dealGame(config: GameConfig): GameState {
  const state: GameState = {
    config,
    rng: config.sharedSeed >>> 0,
    handIndex: 0,
    dealer: config.startingDealer % SEATS,
    wall: [],
    hands: [],
    melds: [],
    discards: [],
    drawn: null,
    mustDiscard: false,
    phase: 'turn',
    toAct: 0,
    pending: null,
    scores: new Array<number>(SEATS).fill(0),
    gangDelta: new Array<number>(SEATS).fill(0),
    autopilot: new Array<boolean>(SEATS).fill(false),
    last: null,
    lastHand: null,
    result: null,
  }
  startHand(state)
  return state
}
