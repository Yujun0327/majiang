import { botMove } from './bot'
import { deepClone } from './clone'
import { claimOptions, isBot, legalMoves, nextHandActor, rankOfClaim, sameMove } from './legality'
import { dealGame, startHand } from './setup'
import { countKinds, removeTiles, sortTiles, type Kind } from './tiles'
import { SEATS, type GameConfig, type GameState, type HandResult, type Move, type Seat } from './types'

/** Points: 点炮 / 抢杠 — the payer alone; 自摸 and 暗杠 / 补杠 — each other seat; 明杠 — the discarder. */
export const POINTS = { ron: 2, zimoEach: 2, anGangEach: 2, buGangEach: 1, mingGang: 3 }

const others = (seat: Seat): Seat[] => [1, 2, 3].map((d) => (seat + d) % SEATS)

function payEach(delta: number[], to: Seat, each: number): void {
  for (const s of others(to)) {
    delta[s] -= each
    delta[to] += each
  }
}

function endHand(state: GameState, r: Omit<HandResult, 'handIndex' | 'delta'>, winDelta: number[] | null): void {
  // a drawn hand (流局) voids the 杠 payments too
  const delta = winDelta ? winDelta.map((d, i) => d + state.gangDelta[i]) : new Array<number>(SEATS).fill(0)
  state.scores = state.scores.map((s, i) => s + delta[i])
  state.lastHand = { ...r, handIndex: state.handIndex, delta }
  state.pending = null
  state.mustDiscard = false
  state.drawn = null
  if (state.handIndex + 1 >= state.config.maxHands) {
    state.phase = 'over'
    state.result = { points: [...state.scores] }
  } else {
    state.phase = 'handOver'
    state.toAct = nextHandActor(state)
  }
}

function drawFor(state: GameState, seat: Seat): void {
  if (state.wall.length === 0) {
    endHand(state, { winner: null, how: 'draw', from: null, tile: null }, null)
    return
  }
  const tile = state.wall.pop()!
  state.hands[seat].push(tile)
  sortTiles(state.hands[seat])
  state.drawn = tile
  state.mustDiscard = false
  state.phase = 'turn'
  state.toAct = seat
  state.pending = null
}

/** Ask the seats that can use the tile, strongest possible claim first, then in turn order. */
function openClaims(state: GameState, kind: Kind, from: Seat, rob: boolean): void {
  const pending = { kind, from, rob, queue: [] as Seat[], best: null }
  const top = (s: Seat) => Math.max(0, ...claimOptions(state, s, pending).map(rankOfClaim))
  pending.queue = others(from)
    .filter((s) => top(s) > 0)
    .sort((a, b) => top(b) - top(a))
  state.pending = pending
  state.phase = 'claim'
  state.drawn = null
  if (pending.queue.length === 0) settleClaims(state)
  else state.toAct = pending.queue[0]
}

function completeBuGang(state: GameState, seat: Seat, kind: Kind): void {
  removeTiles(state.hands[seat], kind)
  const meld = state.melds[seat].find((m) => m.type === 'peng' && m.kinds[0] === kind)!
  meld.type = 'gang'
  meld.kinds.push(kind)
  payEach(state.gangDelta, seat, POINTS.buGangEach)
  drawFor(state, seat)
}

function win(state: GameState, winner: Seat, how: 'ron' | 'rob', from: Seat, tile: Kind): void {
  if (how === 'rob') removeTiles(state.hands[from], tile)
  else state.discards[from].pop()
  state.hands[winner].push(tile)
  sortTiles(state.hands[winner])
  const delta = new Array<number>(SEATS).fill(0)
  delta[from] -= POINTS.ron
  delta[winner] += POINTS.ron
  endHand(state, { winner, how, from, tile }, delta)
}

/** Everyone has been asked: carry out the best claim, or move on. */
function settleClaims(state: GameState): void {
  const { kind, from, rob, best } = state.pending!
  state.pending = null
  if (!best) {
    if (rob) completeBuGang(state, from, kind)
    else drawFor(state, (from + 1) % SEATS)
    return
  }
  const { seat, move } = best
  const hand = state.hands[seat]
  if (move.type === 'hu') return win(state, seat, rob ? 'rob' : 'ron', from, kind)
  state.discards[from].pop()
  state.phase = 'turn'
  state.toAct = seat
  state.drawn = null
  if (move.type === 'peng') {
    removeTiles(hand, kind, 2)
    state.melds[seat].push({ type: 'peng', kinds: [kind, kind, kind], from, concealed: false })
    state.mustDiscard = true
  } else if (move.type === 'chi') {
    removeTiles(hand, move.use[0])
    removeTiles(hand, move.use[1])
    state.melds[seat].push({ type: 'chi', kinds: sortTiles([kind, ...move.use]), from, concealed: false })
    state.mustDiscard = true
  } else if (move.type === 'gang') {
    removeTiles(hand, kind, 3)
    state.melds[seat].push({ type: 'gang', kinds: [kind, kind, kind, kind], from, concealed: false })
    state.gangDelta[from] -= POINTS.mingGang
    state.gangDelta[seat] += POINTS.mingGang
    drawFor(state, seat)
  }
}

/** Apply exactly one move (no bot follow-up). Throws when it is not legal for `actor`. */
export function applyOne(prev: GameState, actor: Seat, move: Move): GameState {
  if (!legalMoves(prev, actor).some((m) => sameMove(m, move))) throw new Error(`illegal move ${move.type} by seat ${actor}`)
  const state = deepClone(prev)

  if (move.type === 'takeover' || move.type === 'resume') {
    state.autopilot[move.type === 'takeover' ? move.seat : actor] = move.type === 'takeover'
    if (state.phase === 'handOver') state.toAct = nextHandActor(state)
    return state
  }
  const kind = move.type === 'discard' || move.type === 'gang' ? move.kind : (state.pending?.kind ?? null)
  state.last = { seat: actor, type: move.type, kind }

  if (move.type === 'nextHand') {
    state.dealer = state.lastHand?.winner ?? state.dealer
    state.handIndex++
    startHand(state)
    return state
  }

  if (state.phase === 'claim') {
    const pending = state.pending!
    if (move.type !== 'pass') pending.best = { seat: actor, move, rank: rankOfClaim(move) }
    const floor = pending.best?.rank ?? 0
    pending.queue = pending.queue.slice(1).filter((s) => claimOptions(state, s, pending).some((m) => rankOfClaim(m) > floor))
    // a 胡 cannot be outranked: the first one asked takes it
    if (move.type === 'hu' || pending.queue.length === 0) settleClaims(state)
    else state.toAct = pending.queue[0]
    return state
  }

  // own turn
  const hand = state.hands[actor]
  if (move.type === 'discard') {
    removeTiles(hand, move.kind)
    state.discards[actor].push(move.kind)
    state.mustDiscard = false
    openClaims(state, move.kind, actor, false)
  } else if (move.type === 'hu') {
    const delta = new Array<number>(SEATS).fill(0)
    payEach(delta, actor, POINTS.zimoEach)
    endHand(state, { winner: actor, how: 'zimo', from: null, tile: state.drawn }, delta)
  } else if (move.type === 'gang') {
    if (countKinds(hand)[move.kind] === 4) {
      removeTiles(hand, move.kind, 4)
      state.melds[actor].push({ type: 'gang', kinds: [move.kind, move.kind, move.kind, move.kind], from: null, concealed: true })
      payEach(state.gangDelta, actor, POINTS.anGangEach)
      drawFor(state, actor)
    } else {
      openClaims(state, move.kind, actor, true) // 补杠 — may be robbed
    }
  }
  return state
}

const botToMove = (s: GameState): boolean => !s.result && (s.phase === 'turn' || s.phase === 'claim') && isBot(s, s.toAct)

/** Let the bots play until a human must decide. Returns each state along the way (empty if no bot moved). */
export function runBots(from: GameState): GameState[] {
  const steps: GameState[] = []
  let state = from
  for (let guard = 0; botToMove(state); guard++) {
    if (guard > 4000) throw new Error('bot loop did not settle')
    state = applyOne(state, state.toAct, botMove(state, state.toAct))
    steps.push(state)
  }
  return steps
}

/** The move, then every bot move it triggers: each intermediate state, the last being the new state. */
export function applySteps(prev: GameState, actor: Seat, move: Move): GameState[] {
  const first = applyOne(prev, actor, move)
  return [first, ...runBots(first)]
}

export function applyMove(prev: GameState, actor: Seat, move: Move): GameState {
  const steps = applySteps(prev, actor, move)
  return steps[steps.length - 1]
}

/** The deal, then the bots' opening moves when a bot deals. */
export function createSteps(config: GameConfig): GameState[] {
  const first = dealGame(config)
  return [first, ...runBots(first)]
}

export function createGame(config: GameConfig): GameState {
  const steps = createSteps(config)
  return steps[steps.length - 1]
}
