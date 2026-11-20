/** How long each part of the table's choreography takes (ms). Shared by the session's pacing and the screen. */

/** The wall sweeps into place. */
export const BUILD_MS = 1000
/** The dealer's dice tumble and settle. */
export const DICE_MS = 1900
/** One grab of tiles during the deal; there are GRABS of them (4-4-4 each, 1 each, the dealer's extra). */
export const GRAB_MS = 150
export const GRABS = 17
/** The whole start-of-hand sequence, with a beat at the end before play begins. */
export const DEAL_MS = BUILD_MS + DICE_MS + GRABS * GRAB_MS + 700

/** A bot's ordinary move stays on screen this long before the next one. */
export const STEP_MS = 900
/** A call (chow / pung / kong) takes longer: the tile visits the hand first. */
export const CALL_MS = 1500
/** A draw waits this long so it follows the throw before it instead of overlapping. */
export const DRAW_DELAY_MS = 420
