/**
 * Where things are on screen, for tiles that fly between them. Seats are
 * rotated layers, so positions are read from the live DOM as screen
 * rectangles; `flyFrom` converts them back into each layer's own axes.
 */

export const places = {
  /** The hand slot I just tapped to throw (used once, by that throw). */
  tap: null as DOMRect | null,
  /** Each seat's newest discard, measured after it has landed. */
  river: [null, null, null, null] as (DOMRect | null)[],
}

/** A wall stack by draw order. */
export function stackRect(order: number): DOMRect | null {
  return document.querySelector(`[data-stack="${order}"]`)?.getBoundingClientRect() ?? null
}

/** A tile-sized spot in the middle of a seat's hand: my own big hand, or another seat's rail on the board. */
export function handRect(seat: number, isMe: boolean): DOMRect | null {
  const el = (isMe ? document.querySelector('.hand') : null) ?? document.querySelector(`[data-rail="${seat}"]`)
  if (!el) return null
  const mid = el.children[Math.floor(el.children.length / 2)]
  return (mid ?? el).getBoundingClientRect()
}
