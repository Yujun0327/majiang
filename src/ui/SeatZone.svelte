<script lang="ts">
  import { SEATS, type GameState, type Meld, type Seat } from '../engine'
  import { lift, toss } from './motion'
  import Tile from './Tile.svelte'

  interface Props {
    gs: GameState
    seat: Seat
    /** Rotation of this seat's layer: 0 bottom (me), -90 right, 180 top, 90 left. */
    rot: number
    isMe: boolean
    /** Light this seat's newest discard. */
    lit: boolean
  }

  let { gs, seat, rot, isMe, lit }: Props = $props()

  const turn = $derived(gs.toAct === seat && (gs.phase === 'turn' || gs.phase === 'claim'))
  const open = $derived(gs.phase === 'handOver' || gs.phase === 'over')
  const signed = (v: number) => (v > 0 ? '+' : '') + v

  /** Which tile of a claimed set lies sideways: it points at the player it was taken from. */
  function sidewaysAt(m: Meld): number {
    if (m.from === null) return -1
    const d = (m.from - seat + SEATS) % SEATS // 3 before me, 2 across, 1 after me
    return d === 3 ? 0 : d === 2 ? 1 : m.kinds.length - 1
  }

  /** Another player's concealed kong stays face down until the hand is over. */
  const shown = (m: Meld) => (m.concealed && !isMe && !open ? m.kinds.map(() => -1) : m.kinds)
</script>

<div class="zone" style="transform: rotate({rot}deg)">
  <div class="river">
    {#each gs.discards[seat] as k, i (i)}
      <span class="cell" in:toss out:lift><Tile kind={k} lit={lit && i === gs.discards[seat].length - 1} /></span>
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
      <div class="rail">
        {#each gs.hands[seat] as k, i (i)}
          <span class="cell" in:toss={{ dy: -0.22, big: 1.2, tilt: 0, duration: 320 }}><Tile kind={k} lit={open && gs.lastHand?.winner === seat && gs.lastHand.tile !== null && i === gs.hands[seat].indexOf(gs.lastHand.tile)} /></span>
        {/each}
      </div>
    {/if}
    <div class="sets">
      {#each gs.melds[seat] as m, i (i)}
        {@const side = sidewaysAt(m)}
        <span class="set" in:toss={{ dy: -0.2, big: 1.7, tilt: 6, duration: 460 }}>
          {#each shown(m) as k, j (j)}<Tile kind={k} sideways={j === side} />{/each}
        </span>
      {/each}
    </div>
  </div>
</div>

<style>
  /* Each seat is a full-board layer drawn as if it sat at the bottom, then rotated into place. */
  .zone { position: absolute; inset: 0; pointer-events: none; }
  .cell { display: block; }

  .river { position: absolute; top: 66.3cqw; left: 50%; width: 29.8cqw; margin-left: -14.9cqw; display: grid; grid-template-columns: repeat(6, 4.8cqw); gap: 0.25cqw 0.2cqw; --tw: 4.8cqw; }

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
  .rail { display: flex; align-items: flex-end; gap: 0.12cqw; --tw: 3.3cqw; }
  .sets { display: flex; align-items: flex-end; gap: 1cqw; --tw: 4.2cqw; }
  .set { display: flex; align-items: flex-end; gap: 0.1cqw; }
</style>
