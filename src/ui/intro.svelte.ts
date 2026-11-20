import { BUILD_MS, DICE_MS, GRABS, GRAB_MS } from '../app/timing'
import { SEATS, type Seat } from '../engine'

export type IntroStage = 'idle' | 'build' | 'dice' | 'deal'

/**
 * The start-of-hand choreography: the wall is built, the dealer rolls, the
 * tiles are dealt. Purely a view of an already-dealt state — it only decides
 * how much of each hand, and of the wall, the table shows at each moment.
 */
export class DealIntro {
  stage = $state<IntroStage>('idle')
  /** Grabs done so far in the deal (0..GRABS). */
  grab = $state(0)
  private timers: ReturnType<typeof setTimeout>[] = []
  private ticker: ReturnType<typeof setInterval> | null = null

  get active(): boolean {
    return this.stage !== 'idle'
  }

  start(onStage?: (stage: IntroStage, grab: number) => void): void {
    this.stop()
    this.stage = 'build'
    this.grab = 0
    onStage?.('build', 0)
    this.timers.push(
      setTimeout(() => {
        this.stage = 'dice'
        onStage?.('dice', 0)
      }, BUILD_MS),
      setTimeout(() => {
        this.stage = 'deal'
        this.ticker = setInterval(() => {
          if (this.grab >= GRABS) return
          this.grab++
          onStage?.('deal', this.grab)
        }, GRAB_MS)
      }, BUILD_MS + DICE_MS),
    )
  }

  stop(): void {
    this.timers.forEach(clearTimeout)
    this.timers = []
    if (this.ticker) clearInterval(this.ticker)
    this.ticker = null
    this.stage = 'idle'
  }

  /**
   * Tiles `seat` holds so far: four at a time for three rounds starting with
   * the dealer, then one each, then the dealer's extra. Infinity when no
   * intro is running (show everything).
   */
  dealt(seat: Seat, dealer: Seat): number {
    if (this.stage === 'idle') return Infinity
    if (this.stage !== 'deal') return 0
    const turn = (seat - dealer + SEATS) % SEATS
    let n = 0
    for (let round = 0; round < 3; round++) if (round * SEATS + turn < this.grab) n += 4
    if (3 * SEATS + turn < this.grab) n += 1
    if (turn === 0 && this.grab >= GRABS) n += 1
    return n
  }

  /** Tiles that have visibly left the wall so far, or null when no intro is running. */
  drawn(dealer: Seat): number | null {
    if (this.stage === 'idle') return null
    let n = 0
    for (let s = 0; s < SEATS; s++) n += this.dealt(s, dealer)
    return n
  }
}
