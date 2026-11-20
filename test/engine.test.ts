import { describe, expect, it } from 'vitest'
import {
  SEATS,
  applyMove,
  applyOne,
  botMove,
  createGame,
  dealGame,
  deepClone,
  defaultConfig,
  fullSet,
  isWin,
  legalMoves,
  publicHash,
  redact,
  sortTiles,
  waits,
} from '../src/engine'
import type { GameState, Kind, Move } from '../src/engine'

// 万 0–8, 筒 9–17, 条 18–26, 东南西北 27–30, 中发白 31–33
const W = (n: number): Kind => n - 1
const T = (n: number): Kind => 8 + n
const S = (n: number): Kind => 17 + n
const EAST = 27
const ZHONG = 31

/** Four humans, seat 0 dealing, hands replaced; the wall becomes whatever is left (draw order = end first). */
function rig(hands: Kind[][], nextDraws: Kind[] = [], humans = 4): GameState {
  const state = deepClone(dealGame(defaultConfig({ humans, maxHands: 2 })))
  const left = fullSet()
  const take = (k: Kind) => {
    const at = left.indexOf(k)
    if (at < 0) throw new Error(`rig: too many of ${k}`)
    left.splice(at, 1)
  }
  hands.forEach((h) => h.forEach(take))
  nextDraws.forEach(take)
  state.hands = hands.map((h) => sortTiles([...h]))
  state.wall = [...left, ...[...nextDraws].reverse()]
  state.drawn = null
  return state
}

const types = (ms: Move[]) => ms.map((m) => m.type)
const total = (s: GameState) =>
  s.wall.length + s.hands.flat().length + s.discards.flat().length + s.melds.flat().reduce((n, m) => n + m.kinds.length, 0)

describe('winning hands', () => {
  it('four melds and a pair', () => {
    expect(isWin([W(1), W(2), W(3), W(4), W(5), W(6), T(7), T(8), T(9), S(2), S(2), S(2), EAST, EAST], 0)).toBe(true)
  })
  it('overlapping runs', () => {
    expect(isWin([W(1), W(1), W(2), W(2), W(3), W(3), W(4), W(5), W(6), T(1), T(1), T(1), S(9), S(9)], 0)).toBe(true)
  })
  it('seven pairs, only when fully concealed', () => {
    const pairs = [W(1), W(1), W(5), W(5), T(2), T(2), T(9), T(9), S(4), S(4), EAST, EAST, ZHONG, ZHONG]
    expect(isWin(pairs, 0)).toBe(true)
    expect(isWin(pairs.slice(0, 11), 1)).toBe(false)
  })
  it('with exposed melds only the rest must fit', () => {
    expect(isWin([W(1), W(2), W(3), EAST, EAST], 3)).toBe(true)
    expect(isWin([W(1), W(2), W(4), EAST, EAST], 3)).toBe(false)
  })
  it('honors do not run, suits do not wrap', () => {
    expect(isWin([27, 28, 29, W(1), W(1)], 3)).toBe(false)
    expect(isWin([W(8), W(9), T(1), EAST, EAST], 3)).toBe(false)
  })
  it('waits', () => {
    expect(waits([W(2), W(3), EAST, EAST], 3)).toEqual([W(1), W(4)])
  })
})

describe('claims', () => {
  it('nobody can claim: the next seat simply draws', () => {
    const h0 = [EAST, EAST, EAST, 32, 32, 32, 33, 33, 33, W(1), W(4), W(7), T(2), S(9)]
    const loose = [
      [W(2), W(5), W(8), T(3), T(6), T(9), S(1), S(4), S(7), 28, 29, 30, ZHONG],
      [W(2), W(5), W(8), T(3), T(6), T(9), S(1), S(4), S(7), 28, 29, 30, ZHONG],
      [W(3), W(6), W(9), T(4), T(7), T(1), S(2), S(5), S(6), 28, 29, 30, ZHONG],
    ]
    const s = rig([h0, ...loose], [T(1)])
    const next = applyOne(s, 0, { type: 'discard', kind: S(9) })
    expect(next.phase).toBe('turn')
    expect(next.toAct).toBe(1)
    expect(next.hands[1]).toHaveLength(14)
  })

  it('碰 outranks 吃; the 吃 seat is only asked if the 碰 seat passes', () => {
    const h0 = [W(5), EAST, EAST, EAST, 32, 32, 32, 33, 33, 33, T(1), T(1), S(9), S(9)]
    const h1 = [W(4), W(6), T(3), T(6), T(9), S(1), S(4), S(7), 28, 29, 30, ZHONG, W(1)] // can 吃 5万
    const h2 = [W(5), W(5), T(4), T(7), S(2), S(5), S(8), 28, 29, 30, ZHONG, W(9), W(8)] // can 碰 5万
    const h3 = [W(2), W(8), T(2), T(5), T(8), S(3), S(6), 28, 29, 30, ZHONG, W(3), T(9)]
    const s = applyOne(rig([h0, h1, h2, h3]), 0, { type: 'discard', kind: W(5) })
    expect(s.phase).toBe('claim')
    expect(s.toAct).toBe(2)
    expect(types(legalMoves(s, 2))).toEqual(expect.arrayContaining(['peng', 'pass']))
    expect(types(legalMoves(s, 1)).includes('chi')).toBe(false) // not asked yet

    const pung = applyOne(s, 2, { type: 'peng' })
    expect(pung.phase).toBe('turn')
    expect(pung.toAct).toBe(2)
    expect(pung.mustDiscard).toBe(true)
    expect(pung.melds[2][0]).toMatchObject({ type: 'peng', from: 0 })
    expect(pung.discards[0]).toEqual([])
    expect(types(legalMoves(pung, 2)).every((t) => t === 'discard' || t === 'takeover')).toBe(true)

    const passed = applyOne(s, 2, { type: 'pass' })
    expect(passed.toAct).toBe(1)
    const chi = applyOne(passed, 1, { type: 'chi', use: [W(4), W(6)] })
    expect(chi.melds[1][0].kinds).toEqual([W(4), W(5), W(6)])
    expect(chi.toAct).toBe(1)
    expect(total(chi)).toBe(136)
  })

  it('胡 on a discard: the discarder alone pays', () => {
    const h0 = [W(1), EAST, EAST, EAST, 32, 32, 32, 33, 33, 33, T(1), T(1), S(9), S(9)]
    const h1 = [W(2), W(3), W(4), W(5), W(6), T(7), T(8), T(9), S(2), S(2), S(2), ZHONG, ZHONG] // waits 1万 4万 7万
    const h2 = [W(9), W(8), T(4), T(7), S(1), S(5), S(8), 28, 29, 30, T(2), T(5), S(4)]
    const h3 = [W(8), W(9), T(2), T(5), T(8), S(3), S(6), 28, 29, 30, S(7), T(3), T(6)]
    const s = applyOne(rig([h0, h1, h2, h3]), 0, { type: 'discard', kind: W(1) })
    expect(s.toAct).toBe(1)
    const won = applyOne(s, 1, { type: 'hu' })
    expect(won.phase).toBe('handOver')
    expect(won.lastHand).toMatchObject({ winner: 1, how: 'ron', from: 0, delta: [-2, 2, 0, 0] })
    expect(won.scores).toEqual([-2, 2, 0, 0])
    expect(total(won)).toBe(136)
  })

  it('自摸: everyone pays; 暗杠 pays and draws a replacement', () => {
    const h0 = [W(1), W(1), W(1), W(1), W(2), W(3), W(4), T(7), T(8), T(9), S(2), S(2), ZHONG, ZHONG]
    const rest = [
      [W(9), W(8), T(4), T(1), S(1), S(5), S(8), 28, 29, 30, T(2), T(5), S(4)],
      [W(8), W(9), T(2), T(5), T(8), S(3), S(6), 28, 29, 30, S(7), T(3), T(6)],
      [W(7), W(6), T(3), T(6), S(4), S(7), S(9), 28, 29, 30, 27, 32, 33],
    ]
    const s = rig([h0, ...rest], [S(2)])
    expect(types(legalMoves(s, 0))).toEqual(expect.arrayContaining(['gang', 'discard']))
    const g = applyOne(s, 0, { type: 'gang', kind: W(1) })
    expect(g.melds[0][0]).toMatchObject({ type: 'gang', concealed: true })
    expect(g.gangDelta).toEqual([6, -2, -2, -2])
    expect(g.drawn).toBe(S(2))
    expect(types(legalMoves(g, 0))).toContain('hu')
    const won = applyOne(g, 0, { type: 'hu' })
    expect(won.lastHand).toMatchObject({ winner: 0, how: 'zimo', delta: [12, -4, -4, -4] })
    expect(total(won)).toBe(136)
  })

  it('补杠 can be robbed', () => {
    const h0 = [W(5), W(2), W(3), W(4), T(7), T(8), T(9), S(2), S(2), ZHONG, ZHONG]
    const h1 = [W(4), W(6), T(1), T(1), T(1), T(2), T(3), T(4), S(5), S(6), S(7), EAST, EAST] // waits 5万
    const h2 = [W(8), W(9), T(2), T(5), T(8), S(3), S(6), 28, 29, 30, S(7), T(3), T(6)]
    const h3 = [W(7), W(6), T(3), T(6), S(4), S(8), S(9), 28, 29, 30, 27, 32, 33]
    const s = rig([h0, h1, h2, h3])
    s.melds[0] = [{ type: 'peng', kinds: [W(5), W(5), W(5)], from: 2, concealed: false }]
    // the three 5万 in the meld came out of the wall
    for (let i = 0; i < 3; i++) s.wall.splice(s.wall.indexOf(W(5)), 1)
    const g = applyOne(s, 0, { type: 'gang', kind: W(5) })
    expect(g.phase).toBe('claim')
    expect(g.pending?.rob).toBe(true)
    expect(g.toAct).toBe(1)
    const robbed = applyOne(g, 1, { type: 'hu' })
    expect(robbed.lastHand).toMatchObject({ winner: 1, how: 'rob', from: 0, delta: [-2, 2, 0, 0] })
    const kept = applyOne(g, 1, { type: 'pass' })
    expect(kept.melds[0][0].kinds).toHaveLength(4)
    expect(kept.gangDelta).toEqual([3, -1, -1, -1])
    expect(kept.toAct).toBe(0)
  })
})

describe('bots and whole sessions', () => {
  it('four-bot tables always finish, conserve the tiles and stay zero-sum', () => {
    let wins = 0
    let hands = 0
    for (let seed = 1; seed <= 60; seed++) {
      // four human seats, each played by the bot policy one move at a time
      let s = dealGame(defaultConfig({ humans: 4, sharedSeed: seed * 7919, maxHands: 4, startingDealer: seed % 4 }))
      let guard = 0
      const tally = () => {
        expect(total(s)).toBe(136)
        expect(s.lastHand!.delta.reduce((a, b) => a + b, 0)).toBe(0)
        hands++
        if (s.lastHand!.winner !== null) wins++
      }
      while (!s.result) {
        if (++guard > 4000) throw new Error('session did not end')
        if (s.phase === 'handOver') {
          tally()
          s = applyOne(s, s.toAct, { type: 'nextHand' })
        } else s = applyOne(s, s.toAct, botMove(s, s.toAct))
      }
      tally()
      expect(s.result.points.reduce((a, b) => a + b, 0)).toBe(0)
      expect(s.handIndex).toBe(3)
    }
    // the bots should actually win hands, not just exhaust the wall
    expect(wins / Math.max(1, hands)).toBeGreaterThan(0.5)
  })

  it('a solo table only ever waits on the human', () => {
    let s = createGame(defaultConfig({ humans: 1, sharedSeed: 99, maxHands: 2, startingDealer: 2 }))
    let moves = 0
    while (!s.result) {
      expect(s.toAct).toBe(0)
      const legal = legalMoves(s, 0)
      expect(legal.length).toBeGreaterThan(0)
      const pick = legal.find((m) => m.type === 'hu') ?? legal.find((m) => m.type === 'nextHand') ?? legal.find((m) => m.type === 'pass') ?? legal.find((m) => m.type === 'discard')!
      s = applyMove(s, 0, pick)
      expect(total(s)).toBe(136)
      if (++moves > 400) throw new Error('too long')
    }
    expect(s.scores.reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('is deterministic and hides other hands', () => {
    const cfg = defaultConfig({ humans: 2, sharedSeed: 5, startingDealer: 3 })
    const a = createGame(cfg)
    const b = createGame(cfg)
    expect(publicHash(a)).toBe(publicHash(b))
    const view = redact(a, 0)
    expect(view.hands[0]).toEqual(a.hands[0])
    for (let s = 1; s < SEATS; s++) expect(view.hands[s].every((k) => k === -1)).toBe(true)
    expect(view.wall.every((k) => k === -1)).toBe(true)
  })

  it('takeover lets the bot play an absent seat, resume gives it back', () => {
    const cfg = defaultConfig({ humans: 2, sharedSeed: 11, startingDealer: 0 })
    const s = createGame(cfg)
    expect(s.toAct).toBe(0)
    const taken = applyMove(s, 1, { type: 'takeover', seat: 0 })
    expect(taken.autopilot[0]).toBe(true)
    expect(taken.toAct).not.toBe(0)
    const back = applyMove(taken, 0, { type: 'resume' })
    expect(back.autopilot[0]).toBe(false)
  })
})
