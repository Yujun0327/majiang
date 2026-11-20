import { applySteps, createGame, legalMoves, publicHash, redact, sameMove, defaultConfig, SEATS } from '../engine'
import type { GameConfig, GameState, Move, Seat } from '../engine'
import { BeaconSession, brokersFromEnv, type Beacon, type GameAdapter, type Transport } from '@yujun/game-net'
import { MONEY_RULES, WalletSession, defaultLedger, loadIdentity, type Identity, type Ledger, type LockState, type Payout } from '@yujun/game-net/wallet'
import { APP } from './persist'

export type SfxEvent = 'tile' | 'claim' | 'gang' | 'win' | 'lose' | 'draw' | 'deal'

export const RULES_VERSION = '1'
/** Hands per session the host may pick. */
export const HAND_CHOICES = [4, 8, 16]
/** Bot moves are revealed one at a time, this far apart. */
const STEP_MS = 520

const TABLE = (MONEY_RULES as Record<string, { table?: { buyIns: number[]; pointValues?: number[]; capPoints?: number } } | undefined>)[APP]?.table
/** Cash per point on offer; empty until the ledger knows this game (free play only). */
export const POINT_VALUES: number[] = TABLE?.pointValues ?? []
export const CAP_POINTS = TABLE?.capPoints ?? 50

function seed32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

/** Money is on only at a full human table (bots have no wallet) with a stake the ledger lists. */
function stakeOf(cfg: GameConfig): number {
  const stake = cfg.pointValue * cfg.capPoints
  return cfg.humans === SEATS && stake > 0 && (TABLE?.buyIns ?? []).includes(stake) ? stake : 0
}

/** Cash per seat from the session's zero-sum points: losses capped at the buy-in, winners share what was lost. */
export function cashPayouts(state: GameState, cfg: GameConfig): number[] {
  const n = cfg.humans
  const out = new Array<number>(n).fill(0)
  const stake = stakeOf(cfg)
  const pts = state.result?.points
  if (!stake || !pts) return out
  let pool = 0
  for (let i = 0; i < n; i++) {
    if (pts[i] < 0) {
      out[i] = -Math.min(-pts[i] * cfg.pointValue, stake)
      pool += -out[i]
    }
  }
  const winners = [...Array(n).keys()].filter((i) => pts[i] > 0)
  const totalWin = winners.reduce((s, i) => s + pts[i], 0)
  let given = 0
  for (const i of winners) {
    out[i] = Math.floor((pool * pts[i]) / totalWin)
    given += out[i]
  }
  if (winners.length) out[winners[0]] += pool - given
  return out
}

interface Pick {
  pointValue: number
  maxHands: number
}

function makeAdapter(host: () => OnlineSession | null): GameAdapter<GameConfig, GameState, Move> {
  return {
    app: APP,
    protocol: 1,
    rulesVersion: RULES_VERSION,
    minSeats: 1,
    maxSeats: SEATS,
    makeConfig: (players, prev) => {
      const h = host()
      const humans = Math.max(1, Math.min(SEATS, players.length))
      const pointValue = prev ? prev.pointValue : (h?.hostPointValue ?? 0)
      return defaultConfig({
        humans,
        names: players.map((p) => p.name),
        sharedSeed: seed32(),
        startingDealer: Math.floor(Math.random() * SEATS),
        maxHands: prev ? prev.maxHands : (h?.hostMaxHands ?? HAND_CHOICES[0]),
        pointValue: humans === SEATS ? pointValue : 0,
        capPoints: CAP_POINTS,
        rulesVersion: RULES_VERSION,
      })
    },
    create: (cfg) => ({ state: createGame(cfg) }),
    apply: (s, actor, move) => {
      const steps = applySteps(s, actor, move)
      return steps[steps.length - 1]
    },
    hash: publicHash,
    actor: (s) => s.toAct,
    isOver: (s) => s.result !== null,
    // claims, takeover and resume are all answered by the engine's own legality
    actorFor: (s, seat, move) => (legalMoves(s, seat).some((m) => sameMove(m, move)) ? seat : null),
    winners: (s) => cashPayouts(s, s.config).map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0),
    payouts: (s, cfg) => cashPayouts(s, cfg),
    stake: stakeOf,
  }
}

type Core = BeaconSession<GameConfig, GameState, Move>

export type OnlineStatus = Core['status']

export interface LobbySeat {
  playerKey: string
  name: string
  ready: boolean
  connected: boolean
}

export interface OnlineTestHooks {
  transport?: Transport<Beacon<GameConfig, Move>>
  now?: () => number
  timers?: boolean
  ledger?: Ledger
  identity?: Identity
}

export class OnlineSession {
  /** The true state, as far as the log goes. */
  state = $state.raw<GameState>() as GameState
  /** What the table shows: lags `state` while bot moves are revealed one by one. */
  shown = $state.raw<GameState>() as GameState
  events = $state<{ id: number; sfx: SfxEvent }[]>([])
  balances = $state<Record<string, number>>({})
  readonly room: string
  readonly myKey: string

  private readonly core: Core
  private wallet: WalletSession<GameConfig, GameState, Move, undefined> | null = null
  private rev = $state(0)
  private pending = $state(0)
  private queue: GameState[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly stagger: boolean
  private eventId = 0
  private gameId = ''
  private seenLog = 0
  private prev: GameState
  private pick = $state<Pick>({ pointValue: 0, maxHands: HAND_CHOICES[0] })
  private balanceKeys = ''

  constructor(room: string, creator: boolean, identity: { key: string; name: string }, test: OnlineTestHooks = {}) {
    const self: { s: OnlineSession | null } = { s: null }
    const core: Core = new BeaconSession(makeAdapter(() => self.s), {
      room,
      creator,
      identity,
      transport: test.transport,
      brokers: test.transport ? undefined : brokersFromEnv(import.meta.env as Record<string, string | undefined>),
      now: test.now,
      timers: test.timers,
      log: (t) => console.log(`[${APP}] ${t}`),
    })
    self.s = this
    this.core = core
    this.room = core.room
    this.myKey = core.myKey
    this.stagger = test.timers !== false
    this.state = this.shown = this.prev = core.state
    this.seenLog = core.logLength
    this.gameId = core.snapshot?.gameId ?? ''
    core.subscribe(() => this.sync())
    const ledger = test.ledger ?? (test.transport ? null : defaultLedger())
    if (ledger) {
      this.wallet = new WalletSession(core, APP, test.identity ?? loadIdentity(), ledger, test.now)
      this.wallet.subscribe(() => this.rev++)
    }
  }

  private get c(): Core {
    void this.rev
    return this.core
  }

  private sync(): void {
    const core = this.core
    const log = core.snapshot?.log ?? []
    if (core.snapshot && core.snapshot.gameId !== this.gameId) {
      this.gameId = core.snapshot.gameId
      this.seenLog = 0
      this.prev = createGame(core.snapshot.cfg)
      this.reveal([this.prev], true)
      this.emit('deal')
    }
    this.state = core.state
    const fresh = log.length - this.seenLog
    if (fresh > 0 && fresh <= 2) {
      let st = this.prev
      const steps: GameState[] = []
      for (const wire of log.slice(this.seenLog)) {
        const part = applySteps(st, wire.actor, wire.move)
        steps.push(...part)
        st = part[part.length - 1]
      }
      this.reveal(steps, false)
    } else if (fresh !== 0) {
      this.reveal([core.state], true) // a bulk catch-up: jump straight to now
    }
    this.seenLog = log.length
    this.prev = core.state
    if (!core.started) {
      if (!core.isHost) {
        const h = core.livePeers.find((p) => p.key === core.hostKey)
        const pick = (h?.extra as { pick?: Pick } | undefined)?.pick
        if (pick) this.pick = pick
      } else if (!core.extra) this.announcePick()
      this.refreshBalances()
    }
    this.rev++
  }

  /** Queue states for the table; passes are skipped, the first state shows at once. */
  private reveal(steps: GameState[], reset: boolean): void {
    if (reset) {
      if (this.timer) clearTimeout(this.timer)
      this.timer = null
      this.queue = []
    }
    const last = steps[steps.length - 1]
    this.queue.push(...steps.filter((s) => s === last || s.last?.type !== 'pass'))
    if (!this.stagger || reset) {
      while (this.queue.length) this.show(this.queue.shift()!)
      this.pending = 0
    } else if (!this.timer) this.drain()
  }

  private drain(): void {
    this.timer = null
    const next = this.queue.shift()
    if (next) this.show(next)
    this.pending = this.queue.length
    if (this.queue.length) this.timer = setTimeout(() => this.drain(), STEP_MS)
  }

  private show(next: GameState): void {
    const before = this.shown
    this.shown = next
    const t = next.last?.type
    if (next.lastHand && next.lastHand !== before.lastHand && next.lastHand.handIndex !== before.lastHand?.handIndex) {
      const w = next.lastHand.winner
      this.emit(w === null ? 'draw' : w === this.core.seat ? 'win' : 'lose')
    } else if (t === 'discard') this.emit('tile')
    else if (t === 'gang') this.emit('gang')
    else if (t === 'chi' || t === 'peng') this.emit('claim')
    else if (t === 'nextHand') this.emit('deal')
  }

  private emit(sfx: SfxEvent): void {
    this.events = [...this.events.slice(-5), { id: this.eventId++, sfx }]
  }

  /* ---------------- the table ---------------- */

  get cfg(): GameConfig {
    return this.shown.config
  }

  get mySeat(): Seat | null {
    return this.c.seat
  }

  /** The redacted state the table renders. */
  get view(): GameState {
    return redact(this.shown, this.c.seat)
  }

  /** True while bot moves are still being revealed; input waits. */
  get busy(): boolean {
    return this.pending > 0
  }

  myMoves(): Move[] {
    const seat = this.c.seat
    if (seat === null || this.busy || this.state.result) return []
    return legalMoves(this.state, seat)
  }

  submit(move: Move): void {
    this.core.submit(move)
  }

  /** The seat we are waiting on when its player has gone quiet, else null. */
  get absentSeat(): Seat | null {
    const key = this.c.waitingOn
    const snap = this.core.snapshot
    return key && snap ? (snap.seats[key] ?? null) : null
  }

  /* ---------------- lobby ---------------- */

  get status(): OnlineStatus {
    return this.c.status
  }

  get playing(): boolean {
    return this.c.playing
  }

  get spectator(): boolean {
    return this.c.spectator
  }

  get isHost(): boolean {
    return this.c.isHost
  }

  get hostKey(): string {
    return this.c.hostKey
  }

  get seats(): LobbySeat[] {
    return this.c.players.map((p) => ({ playerKey: p.key, name: p.name, ready: p.ready, connected: p.connected }))
  }

  get canStart(): boolean {
    return this.c.canStart
  }

  get hostPointValue(): number {
    void this.rev
    return this.pick.pointValue
  }

  set hostPointValue(v: number) {
    this.pick = { ...this.pick, pointValue: v }
    this.announcePick()
  }

  get hostMaxHands(): number {
    void this.rev
    return this.pick.maxHands
  }

  set hostMaxHands(v: number) {
    this.pick = { ...this.pick, maxHands: v }
    this.announcePick()
  }

  /** The buy-in everyone locks if four humans sit down at the chosen point value. */
  get buyIn(): number {
    return this.hostPointValue * CAP_POINTS
  }

  private announcePick(): void {
    if (this.core.isHost && !this.core.started) this.core.setExtra({ pick: $state.snapshot(this.pick) })
  }

  get canAfford(): boolean {
    if (!this.buyIn || !this.wallet || this.seats.length < SEATS) return true
    const mine = this.balances[this.myKey]
    return mine === undefined ? true : mine >= this.buyIn
  }

  private refreshBalances(): void {
    const ledger = this.ledger
    if (!ledger) return
    const keys = this.core.players.map((p) => p.key)
    const sig = keys.join(',')
    if (sig === this.balanceKeys) return
    this.balanceKeys = sig
    for (const key of keys) {
      void ledger.readPlayer(key).then((p) => {
        if (p) this.balances = { ...this.balances, [key]: p.balance }
      })
    }
  }

  setReady(ready: boolean): void {
    if (ready && !this.canAfford) return
    this.core.setReady(ready)
  }

  rename(name: string): void {
    this.core.setName(name)
  }

  startGame(): void {
    this.core.startGame()
  }

  requestRematch(): void {
    this.core.requestRematch()
  }

  relayCount(): number {
    return this.c.channelCount()
  }

  brokerCount(): number {
    return this.core.channels().length
  }

  rescan(): void {
    this.core.rescan()
  }

  get net(): Core {
    return this.core
  }

  get payout(): Payout | null {
    void this.rev
    return this.wallet?.payout ?? null
  }

  get lockState(): LockState | null {
    void this.rev
    return this.wallet?.lock ?? null
  }

  get ledger(): Ledger | null {
    return this.wallet ? (this.wallet as unknown as { ledger: Ledger }).ledger : null
  }

  leave(): void {
    this.destroy(true)
  }

  destroy(leaving = false): void {
    if (this.timer) clearTimeout(this.timer)
    this.wallet?.destroy()
    if (leaving) this.core.leave()
    else this.core.destroy()
  }
}
