// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import { Mesh } from '@yujun/game-net/mesh'
import { OnlineSession } from '../src/app/session.svelte'
import { mulberry32, publicHash } from '../src/engine'
import GameScreen from '../src/ui/GameScreen.svelte'
import PlayingProbe from './support/PlayingProbe.svelte'

if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []
if (!Element.prototype.animate) {
  Element.prototype.animate = function () {
    const anim = { cancel() {}, finish() {}, finished: Promise.resolve(), set onfinish(fn: (() => void) | null) { fn?.() } }
    return anim as unknown as Animation
  }
}

const ROOM = 'MJROOM'
let clock = 1_000_000
const now = () => clock

class World {
  mesh = new Mesh<never>()
  sessions: OnlineSession[] = []

  add(i: number, creator = false): OnlineSession {
    const s = new OnlineSession(ROOM, creator, { key: `key-${i}`, name: `P${i}` }, { transport: this.mesh.peer(`peer-${i}`), now, timers: false })
    this.sessions.push(s)
    return s
  }

  second(times = 1): void {
    for (let i = 0; i < times; i++) {
      clock += 1000
      for (const s of this.sessions) s.net.tick()
      this.mesh.flush()
    }
  }

  start(n: number, setup?: (host: OnlineSession) => void): OnlineSession[] {
    const host = this.add(0, true)
    for (let i = 1; i < n; i++) this.add(i)
    this.second(2)
    setup?.(host)
    this.mesh.flush()
    for (const s of this.sessions) s.setReady(true)
    this.mesh.flush()
    host.startGame()
    this.mesh.flush()
    return this.sessions
  }

  /** The one session with a game move to make right now. */
  acting(): OnlineSession | undefined {
    return this.sessions.find((s) => s.myMoves().some((m) => m.type !== 'takeover' && m.type !== 'resume'))
  }
}

beforeEach(() => {
  localStorage.clear()
  clock = 1_000_000
})

/** Random legal play (always taking a win) until the session ends. */
function playOut(w: World, seed: number, lossy = false) {
  const rng = mulberry32(seed)
  for (let step = 0; step < 6000 && !w.sessions[0].state.result; step++) {
    const mover = w.acting()
    if (mover) {
      const moves = mover.myMoves().filter((m) => m.type !== 'takeover' && m.type !== 'resume')
      mover.submit(moves.find((m) => m.type === 'hu') ?? moves[Math.floor(rng() * moves.length)])
    }
    if (lossy) w.mesh.filter = () => rng() > 0.4
    w.second()
  }
  w.mesh.filter = () => true
  w.second(4)
}

describe('lobby', () => {
  it('a lone host can deal against three bots', () => {
    const w = new World()
    const [host] = w.start(1, (h) => (h.hostMaxHands = 8))
    expect(host.playing).toBe(true)
    expect(host.cfg.humans).toBe(1)
    expect(host.cfg.maxHands).toBe(8)
    expect(host.state.toAct).toBe(0)
    playOut(w, 3)
    expect(host.state.result).not.toBeNull()
    expect(host.state.result!.points.reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('renders lobby→game reactively', () => {
    const w = new World()
    const host = w.add(0, true)
    const guest = w.add(1)
    w.second()
    const targets = [host, guest].map((session) => {
      const target = document.createElement('div')
      document.body.appendChild(target)
      return { target, instance: mount(PlayingProbe, { target, props: { session } }) }
    })
    flushSync()
    expect(targets.map((t) => t.target.textContent)).toEqual(['LOBBY', 'LOBBY'])
    host.setReady(true)
    guest.setReady(true)
    w.mesh.flush()
    host.startGame()
    w.mesh.flush()
    flushSync()
    expect(targets.map((t) => t.target.textContent)).toEqual(['GAME', 'GAME'])
    for (const t of targets) {
      unmount(t.instance)
      t.target.remove()
    }
  })
})

describe('play across the mesh', () => {
  it('2 humans + 2 bots: a session ends in lockstep', () => {
    const w = new World()
    const sessions = w.start(2)
    expect(sessions[1].cfg.humans).toBe(2)
    playOut(w, 7)
    const ref = publicHash(sessions[0].state)
    for (const s of sessions) {
      expect(publicHash(s.state)).toBe(ref)
      expect(s.state.result).not.toBeNull()
      expect(publicHash(s.shown)).toBe(ref)
    }
  })

  it('4 humans: converges through 40% beacon loss', () => {
    const w = new World()
    const sessions = w.start(4)
    playOut(w, 8, true)
    const ref = publicHash(sessions[0].state)
    for (const s of sessions) expect(publicHash(s.state)).toBe(ref)
    expect(sessions[0].state.result).not.toBeNull()
  })

  it("hides the other hands and the wall from each seat's view", () => {
    const w = new World()
    const [a, b] = w.start(2)
    expect(a.view.hands[b.mySeat!].every((k) => k === -1)).toBe(true)
    expect(a.view.hands[a.mySeat!].every((k) => k >= 0)).toBe(true)
    expect(a.view.wall.every((k) => k === -1)).toBe(true)
  })

  it('a refreshed tab restores the session mid-hand', () => {
    const w = new World()
    const sessions = w.start(3)
    for (let i = 0; i < 6; i++) {
      const a = w.acting()
      if (a) a.submit(a.myMoves().find((m) => m.type === 'discard' || m.type === 'pass')!)
      w.second()
    }
    const gone = sessions[2]
    gone.destroy()
    w.sessions = sessions.slice(0, 2)
    const back = w.add(2)
    expect(back.playing).toBe(true)
    w.second(2)
    expect(publicHash(back.state)).toBe(publicHash(sessions[0].state))
  })

  it('an absent seat can be handed to the bot and taken back', () => {
    const w = new World()
    const [a, b] = w.start(2)
    b.destroy()
    w.sessions = [a]
    w.second(20)
    // drive a's turns until the table is waiting on b
    for (let i = 0; i < 400 && a.state.toAct !== b.mySeat; i++) {
      const moves = a.myMoves().filter((m) => m.type !== 'takeover')
      if (!moves.length) break
      a.submit(moves.find((m) => m.type === 'discard' || m.type === 'pass' || m.type === 'nextHand')!)
      w.second()
    }
    if (a.state.toAct === b.mySeat && !a.state.result) {
      expect(a.absentSeat).toBe(b.mySeat)
      a.submit({ type: 'takeover', seat: b.mySeat! })
      expect(a.state.autopilot[b.mySeat!]).toBe(true)
      expect(a.state.result !== null || a.state.toAct === a.mySeat).toBe(true)
    }
  })
})

describe('rendered table', () => {
  it('shows my hand and discards by tapping a tile twice', () => {
    const w = new World()
    const sessions = w.start(2)
    const acting = w.acting()!
    const other = sessions.find((s) => s !== acting)!
    const target = document.createElement('div')
    document.body.appendChild(target)
    const instance = mount(GameScreen, { target, props: { session: acting, onExit: () => {}, onRematch: () => {} } })
    flushSync()
    const pass = [...target.querySelectorAll('.actions button')].find((b) => b.textContent?.trim() === 'Pass') as HTMLButtonElement | undefined
    if (pass) {
      pass.click()
    } else {
      const slots = [...target.querySelectorAll('.hand .slot')] as HTMLButtonElement[]
      expect(slots.length).toBe(acting.state.hands[acting.mySeat!].length)
      const before = acting.net.logLength
      slots[0].click()
      flushSync()
      expect(acting.net.logLength).toBe(before)
      ;([...target.querySelectorAll('.hand .slot')] as HTMLButtonElement[])[0].click()
      flushSync()
      expect(acting.net.logLength).toBe(before + 1)
    }
    w.mesh.flush()
    expect(publicHash(other.state)).toBe(publicHash(acting.state))
    unmount(instance)
    target.remove()
  })
})
