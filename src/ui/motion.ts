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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export interface Flight {
  /** Where the tile starts, as a screen rectangle; null = no flight. */
  from: DOMRect | null
  /** A stop on the way (a claimed tile visits the caller's hand before the set is laid down). */
  via?: DOMRect | null
  /** Rotation of the layer the node lives in, so screen offsets can be turned into its own axes. */
  rot?: number
  delay?: number
  duration?: number
  /** Fraction of the duration to stay at `from` before moving (companion tiles waiting in the hand). */
  wait?: number
  spin?: number
}

/**
 * A tile travelling from somewhere else on screen into the place it now
 * occupies. The node itself is animated (no overlay): it starts displaced to
 * `from`, scaled to that spot's size, and arcs home with a little spin.
 */
export function flyFrom(node: Element, { from, via = null, rot = 0, delay = 0, duration, wait = 0, spin = 14 }: Flight) {
  if (!from || !motionOk() || (from.width === 0 && from.height === 0)) return { duration: 0 }
  const to = node.getBoundingClientRect()
  if (to.width === 0 && to.height === 0) return { duration: 0 }
  const a = (rot * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const size = (r: DOMRect) => Math.max(r.width, r.height)
  /** Offset and scale of a screen rectangle, in the node's own (possibly rotated) axes. */
  const place = (r: DOMRect) => {
    const dx = r.left + r.width / 2 - (to.left + to.width / 2)
    const dy = r.top + r.height / 2 - (to.top + to.height / 2)
    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos, s: clamp(size(r) / size(to), 0.45, 3) }
  }
  const A = place(from)
  const B = via ? place(via) : null
  const HOME = { x: 0, y: 0, s: 1 }
  const mix = (p: typeof A, q: typeof A, e: number) => ({ x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e, s: p.s + (q.s - p.s) * e })
  return {
    delay,
    duration: duration ?? (B || wait ? 1050 : 520),
    css: (t: number) => {
      let at = A
      let e = 0
      if (B) {
        // from → the hand, a pause there, then down into place
        if (t < 0.38) at = mix(A, B, settle(t / 0.38))
        else if (t < 0.56) at = B
        else {
          e = settle((t - 0.56) / 0.44)
          at = mix(B, HOME, e)
        }
      } else {
        e = t <= wait ? 0 : settle((t - wait) / (1 - wait))
        at = mix(A, HOME, e)
      }
      const hop = Math.sin(Math.PI * e) * 0.32 // rises off the table mid-flight
      return `transform: translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) scale(${(at.s + hop).toFixed(3)}) rotate(${((1 - e) * spin * (e > 0 ? 1 : 0)).toFixed(1)}deg); position: relative; z-index: 9;`
    },
  }
}

/** A tile picked up off the board: it swells and fades. */
export function lift(_node: Element, { duration = 260 } = {}) {
  return {
    duration: dur(duration),
    css: (t: number) => `transform: scale(${(1 + (1 - t) * 0.7).toFixed(3)}); opacity: ${t.toFixed(2)}; position: relative; z-index: 6;`,
  }
}
