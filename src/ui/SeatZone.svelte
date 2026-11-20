<script lang="ts">
  import { DEAL_FLIGHT_MS, DRAW_DELAY_MS, FLIGHT_MS } from '../app/timing'
  import { SEATS, type GameState, type Meld, type Seat } from '../engine'
  import { flyFrom } from './motion'
  import { handRect, places, stackRect } from './places'
  import Tile from './Tile.svelte'
  import { stackOfLast } from './wall'

  interface Props {
    gs: GameState
    seat: Seat
    /** Rotation of this seat's layer: 0 bottom (me), -90 right, 180 top, 90 left. */
    rot: number
    isMe: boolean
    /** Light this seat's newest discard. */
    lit: boolean
    /** How many of the hand's tiles to show (the deal fills it in batches). */
    limit: number
    /** Tiles that have visibly left the wall, to find where a drawn tile comes from. */
    drawn: number
    /** The start-of-hand sequence is running. */
    dealing: boolean
  }

  let { gs, seat, rot, isMe, lit, limit, drawn, dealing }: Props = $props()

  const turn = $derived(gs.toAct === seat && (gs.phase === 'turn' || gs.phase === 'claim') && !dealing)
  const open = $derived(gs.phase === 'handOver' || gs.phase === 'over')
  const rail = $derived(gs.hands[seat].slice(0, limit))
  /** This seat is holding a tile it just drew. */
  const fresh = $derived(!dealing && gs.phase === 'turn' && gs.toAct === seat && gs.drawn !== null)
  const signed = (v: number) => (v > 0 ? '+' : '') + v

  /** Which tile of a claimed set lies sideways: it points at the player it was taken from. */
  function sidewaysAt(m: Meld): number {
    if (m.from === null) return -1
    const d = (m.from - seat + SEATS) % SEATS // 3 before me, 2 across, 1 after me
    return d === 3 ? 0 : d === 2 ? 1 : m.kinds.length - 1
  }

  /** Another player's concealed kong stays face down until the hand is over. */
  const shown = (m: Meld) => (m.concealed && !isMe && !open ? m.kinds.map(() => -1) : m.kinds)

  /** A throw: from the slot I tapped, or from the middle of this seat's hand, to its place in the rows. */
  function throwIn(node: Element) {
    let from = handRect(seat, isMe)
    if (isMe && places.tap) {
      from = places.tap
      places.tap = null
    }
    return flyFrom(node, { from, rot })
  }

  /** A draw (or a dealt batch): from the wall stack it left, into the hand. */
  function drawIn(node: Element) {
    return flyFrom(node, { from: stackRect(stackOfLast(drawn)), rot, spin: 0, delay: dealing ? 0 : DRAW_DELAY_MS, duration: dealing ? DEAL_FLIGHT_MS : FLIGHT_MS })
  }

  /**
   * A set being laid down. The claimed tile travels from the discard rows to
   * the caller's hand, waits, then goes down with the tiles that were waiting
   * in the hand for it.
   */
  function setIn(node: Element, { m, j }: { m: Meld; j: number }) {
    const hand = handRect(seat, isMe)
    if (m.from !== null && j === sidewaysAt(m)) return flyFrom(node, { from: places.river[m.from] ?? hand, via: hand, rot })
    return flyFrom(node, { from: hand, rot, spin: 0, wait: m.from === null ? 0 : 0.56 })
  }

  // remember where this seat's newest discard lies once it has landed, so a claim can start from there
  let riverEl = $state<HTMLElement>()
  $effect(() => {
    void gs.discards[seat].length
    const t = setTimeout(() => (places.river[seat] = riverEl?.lastElementChild?.getBoundingClientRect() ?? null), FLIGHT_MS + 250)
    return () => clearTimeout(t)
  })
</script>

<div class="zone" class:acting={gs.last?.seat === seat} style="transform: rotate({rot}deg)">
  <div class="river" bind:this={riverEl}>
    {#each gs.discards[seat] as k, i (i)}
      {@const newest = lit && i === gs.discards[seat].length - 1}
      <span class="cell" class:newest in:throwIn><Tile kind={k} lit={newest} /></span>
    {/each}
  </div>

  <div class="plate" class:turn class:flip={rot === 180} class:winner={open && gs.lastHand?.winner === seat}>
    <span class="name">{gs.config.names[seat]}{isMe ? ' (you)' : ''}</span>
    {#if gs.dealer === seat}<span class="badge">Dealer</span>{/if}
    {#if gs.autopilot[seat]}<span class="note">bot playing</span>{/if}
    <span class="score">{signed(gs.scores[seat])}</span>
  </div>

  <div class="strip">
    {#if !isMe}
      <div class="rail" data-rail={seat}>
        {#each rail as k, i (i)}
          <span class="cell" class:fresh={fresh && i === rail.length - 1} in:drawIn>
            <Tile kind={k} lit={open && gs.lastHand?.winner === seat && gs.lastHand.tile !== null && i === gs.hands[seat].indexOf(gs.lastHand.tile)} />
          </span>
        {/each}
      </div>
    {/if}
    <div class="sets">
      {#each gs.melds[seat] as m, i (i)}
        {@const side = sidewaysAt(m)}
        <span class="set">
          {#each shown(m) as k, j (j)}<span class="cell" in:setIn|global={{ m, j }}><Tile kind={k} sideways={j === side} /></span>{/each}
        </span>
      {/each}
    </div>
  </div>
</div>

<style>
  /* Each seat is a full-board layer drawn as if it sat at the bottom, then rotated into place. */
  .zone { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
  .zone.acting { z-index: 3; }
  .cell { display: block; position: relative; }

  .river { position: absolute; top: 65.7cqw; left: 50%; width: 30.6cqw; margin-left: -15.3cqw; display: grid; grid-template-columns: repeat(7, 4.2cqw); gap: 0.25cqw 0.2cqw; --tw: 4.2cqw; }
  /* the newest discard lands with a ring spreading out from it */
  .cell.newest::after { content: ''; position: absolute; inset: -18%; border-radius: 22%; border: 0.4cqw solid var(--brass-hi); opacity: 0; animation: ripple 930ms ease-out 650ms both; }

  .plate { position: absolute; left: 50%; bottom: 7.1cqw; transform: translateX(-50%); display: flex; align-items: center; gap: 1cqw; max-width: 60cqw; padding: 0.3cqw 1.6cqw; border-radius: 99px; background: rgb(0 0 0 / 0.32); border: 1px solid rgb(243 236 218 / 0.14); font-size: clamp(9.5px, 2.3cqw, 15px); line-height: 1.3; white-space: nowrap; transition: border-color 200ms ease, box-shadow 200ms ease; }
  .plate.flip { transform: translateX(-50%) rotate(180deg); }
  .plate.turn { border-color: var(--brass-hi); box-shadow: 0 0 0 1px var(--brass-hi), 0 0 2.4cqw rgb(236 208 126 / 0.55); }
  .plate.winner { background: var(--brass); color: var(--felt-deep); border-color: var(--brass-hi); }
  .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
  .badge { background: var(--oxblood); color: var(--cream); font-size: 0.78em; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; padding: 0 0.5em; border-radius: 4px; }
  .note { opacity: 0.7; font-size: 0.85em; }
  .score { font-variant-numeric: tabular-nums; color: var(--brass-hi); font-weight: 600; }
  .plate.winner .score { color: inherit; }

  .strip { position: absolute; left: 9cqw; right: 9cqw; bottom: 1.4cqw; height: 5.6cqw; display: flex; align-items: flex-end; justify-content: center; gap: 1.6cqw; }
  .rail { display: flex; align-items: flex-end; gap: 0.12cqw; --tw: 3.3cqw; min-width: 3.3cqw; min-height: 4.4cqw; }
  /* the tile this seat just drew stands a little apart, glowing, until it throws */
  .cell.fresh { margin-left: 1cqw; filter: drop-shadow(0 0 0.9cqw var(--brass-hi)) drop-shadow(0 0 0.3cqw var(--brass-hi)); transform: translateY(-0.7cqw); }
  .sets { display: flex; align-items: flex-end; gap: 1cqw; --tw: 4.2cqw; }
  .set { display: flex; align-items: flex-end; gap: 0.1cqw; }

  @keyframes ripple { from { opacity: 0.95; transform: scale(0.7); } to { opacity: 0; transform: scale(1.7); } }
</style>
