/** How long each part of the table's choreography takes (ms). Shared by the session's pacing, the screen and the sound. */

/** The wall sweeps into place. */
export const BUILD_MS = 3000
/** The dealer's dice tumble and settle; they roll for ROLL_MS of it. */
export const DICE_MS = 5700
export const ROLL_MS = 3700
/** One grab of tiles during the deal; there are GRABS of them (4-4-4 each, 1 each, the dealer's extra). */
export const GRAB_MS = 450
export const GRABS = 17
/** A dealt batch's flight from the wall to a hand. */
export const DEAL_FLIGHT_MS = 900
/** The whole start-of-hand sequence, with a beat at the end before play begins. */
export const DEAL_MS = BUILD_MS + DICE_MS + GRABS * GRAB_MS + 1800

/** A tile's flight: wall to hand, or hand to table. */
export const FLIGHT_MS = 780
/** A call's flight: table to the caller's hand, a pause, then down as a set. */
export const CALL_FLIGHT_MS = 1575
/** A draw waits this long so it follows the throw before it instead of overlapping. */
export const DRAW_DELAY_MS = 630

/** A bot's ordinary move stays on screen this long before the next one. */
export const STEP_MS = 1350
/** A call (chow / pung / kong) takes longer: the tile visits the hand first. */
export const CALL_MS = 2250
