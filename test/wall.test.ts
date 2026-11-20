import { describe, expect, it } from 'vitest'
import { applyOne, botMove, dealGame, defaultConfig } from '../src/engine'
import { PER_SIDE, STACKS, TILES, drawnOf, levelOf, openingOf, orderOf, stackOfLast } from '../src/ui/wall'

describe('the wall picture', () => {
  it('gives every stack a distinct place in the draw order, starting at the opening', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = dealGame(defaultConfig({ humans: 4, sharedSeed: seed * 104729, startingDealer: seed % 4 }))
      const open = openingOf(s)
      expect(open.dice.every((d) => d >= 1 && d <= 6)).toBe(true)
      expect(open.total).toBe(open.dice[0] + open.dice[1])
      const orders = new Set<number>()
      for (let seat = 0; seat < 4; seat++) for (let pos = 0; pos < PER_SIDE; pos++) orders.add(orderOf(open, seat, pos))
      expect(orders.size).toBe(STACKS)
      // the first stack taken is `total` in from the right end of the opened side
      expect(orderOf(open, open.side, PER_SIDE - 1 - open.total)).toBe(0)
      // the stacks to its right are the very last ones
      expect(orderOf(open, open.side, PER_SIDE - 1)).toBe(STACKS - open.total)
    }
  })

  it('shows exactly the tiles still in the wall, and the dice hold for the whole hand', () => {
    let s = dealGame(defaultConfig({ humans: 4, sharedSeed: 2024, maxHands: 1 }))
    const dice = openingOf(s).dice
    expect(drawnOf(s)).toBe(53)
    for (let guard = 0; !s.result && guard < 2000; guard++) {
      s = applyOne(s, s.toAct, botMove(s, s.toAct))
      const drawn = drawnOf(s)
      let shown = 0
      for (let j = 0; j < STACKS; j++) shown += levelOf(drawn, j)
      expect(shown).toBe(s.wall.length)
      expect(TILES - drawn).toBe(s.wall.length)
      expect(levelOf(drawn, stackOfLast(drawn))).toBeLessThan(2)
      expect(openingOf(s).dice).toEqual(dice)
    }
  })
})
