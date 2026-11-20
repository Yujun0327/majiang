/** Shared motion vocabulary. JS transitions honor reduced-motion via zeroed durations. */

export function motionOk(): boolean {
  return typeof matchMedia === 'undefined' || !matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Duration that collapses to 0 under prefers-reduced-motion. */
export function dur(ms: number): number {
  return motionOk() ? ms : 0
}

/** The house easing: quick start, gentle settle. */
export const settle = (t: number) => 1 - Math.pow(1 - t, 3)

/** A slight overshoot, for tiles landing on the felt. */
export const thud = (t: number) => {
  const c = 1.9
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

/**
 * A tile thrown onto the board. It starts `dy` board-widths away along the
 * seat's own vertical axis (positive = from the player's edge, negative = from
 * the middle), larger and tilted, and lands in place. Seats are rotated
 * layers, so the same transition serves all four sides.
 */
export function toss(node: Element, { dy = 0.26, big = 1.9, tilt = -14, duration = 420 } = {}) {
  const board = node.closest('.board') as HTMLElement | null
  const d = (board?.clientWidth ?? 400) * dy
  return {
    duration: dur(duration),
    easing: thud,
    css: (t: number) =>
      `transform: translateY(${((1 - t) * d).toFixed(1)}px) scale(${(1 + (1 - t) * (big - 1)).toFixed(3)}) rotate(${((1 - t) * tilt).toFixed(1)}deg); opacity: ${Math.min(1, Math.max(0, t * 4)).toFixed(2)}; position: relative; z-index: 6;`,
  }
}

/** A tile picked up off the board: it swells and fades. */
export function lift(_node: Element, { duration = 260 } = {}) {
  return {
    duration: dur(duration),
    css: (t: number) => `transform: scale(${(1 + (1 - t) * 0.7).toFixed(3)}); opacity: ${t.toFixed(2)}; position: relative; z-index: 6;`,
  }
}
