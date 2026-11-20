<script lang="ts">
  import { SEATS, type GameState, type Seat } from '../engine'
  import { PER_SIDE, levelOf, orderOf, openingOf } from './wall'

  interface Props {
    gs: GameState
    /** The seat drawn at the bottom. */
    me: Seat
    /** Tiles that have visibly left the wall. */
    drawn: number
    /** Play the wall sweeping into place. */
    building: boolean
    /** Point out where the wall is opened. */
    mark: boolean
  }

  let { gs, me, drawn, building, mark }: Props = $props()

  const ROT = [0, -90, 180, 90]
  const open = $derived(openingOf(gs))
  const sides = $derived(
    [0, 1, 2, 3].map((d) => {
      const seat = (me + d) % SEATS
      return { seat, rot: ROT[d], stacks: Array.from({ length: PER_SIDE }, (_, pos) => orderOf(open, seat, pos)) }
    }),
  )
</script>

{#each sides as side (side.seat)}
  <div class="side" style="transform: rotate({side.rot}deg)">
    <div class="row" class:building>
      {#each side.stacks as order, pos (pos)}
        <span class="stack lv{levelOf(drawn, order)}" class:open={mark && order === 0} class:last={mark && order === 67} data-stack={order} style="--i: {order}"></span>
      {/each}
    </div>
  </div>
{/each}

<style>
  /* One side of the wall per seat, drawn at the bottom and rotated into place. Each side is pushed
     to its right so the four overlap at the corners like a pinwheel. */
  .side { position: absolute; inset: 0; pointer-events: none; }
  .row { position: absolute; top: 83.5cqw; left: 26.6cqw; display: flex; gap: 0.07cqw; }
  .stack { width: 2.9cqw; height: 3.87cqw; flex: none; border-radius: 0.5cqw; background: linear-gradient(160deg, #23806a, #17604d); border: 0.14cqw solid #0a2a22; box-shadow: inset 0 0 0 0.3cqw rgb(255 255 255 / 0.1), 0 0.6cqw 0 #e9e1cc, 0 0.75cqw 0 #6f6650, 0 1cqw 1cqw rgb(0 0 0 / 0.35); transition: box-shadow 160ms ease, opacity 160ms ease, transform 160ms ease; }
  /* one tile left in the stack: it sits lower, with a thinner edge */
  .stack.lv1 { box-shadow: inset 0 0 0 0.3cqw rgb(255 255 255 / 0.1), 0 0.25cqw 0 #6f6650, 0 0.5cqw 0.6cqw rgb(0 0 0 / 0.3); transform: translateY(0.4cqw); filter: brightness(0.86); }
  .stack.lv0 { opacity: 0; box-shadow: none; }
  .stack.open { outline: 0.35cqw solid var(--brass-hi); outline-offset: 0.2cqw; animation: beacon 700ms ease-in-out infinite alternate; z-index: 2; position: relative; }
  .stack.last { filter: brightness(0.8); }
  .building .stack { animation: build 320ms ease-out both; animation-delay: calc(var(--i) * 9ms); }

  @keyframes build { from { opacity: 0; transform: translateY(-3cqw) scale(1.5); } }
  @keyframes beacon { to { box-shadow: 0 0 2.4cqw 0.6cqw rgb(236 208 126 / 0.8); } }
</style>
