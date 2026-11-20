<script lang="ts">
  import { ROLL_MS } from '../app/timing'
  import { SEATS, kindName, type GameState, type Seat } from '../engine'
  import BoardArt from './BoardArt.svelte'
  import Dice from './Dice.svelte'
  import type { DealIntro } from './intro.svelte'
  import SeatZone from './SeatZone.svelte'
  import Tile from './Tile.svelte'
  import Wall from './Wall.svelte'
  import { drawnOf, openingOf } from './wall'

  interface Props {
    gs: GameState
    /** The seat drawn at the bottom. */
    me: Seat
    seated: boolean
    /** Changes with every revealed step, so one-shot effects replay. */
    tick: number
    /** The start-of-hand sequence (idle most of the time). */
    intro: DealIntro
  }

  let { gs, me, seated, tick, intro }: Props = $props()

  /** Layer rotation by how many seats after me: me, right, across, left. */
  const ROT = [0, -90, 180, 90]
  const rel = (seat: Seat) => (seat - me + SEATS) % SEATS
  const seats = $derived([0, 1, 2, 3].map((d) => ({ seat: (me + d) % SEATS, rot: ROT[d] })))
  const live = $derived((gs.phase === 'turn' || gs.phase === 'claim') && !intro.active)
  const who = (seat: Seat) => (seated && seat === me ? 'you' : gs.config.names[seat])
  const drawn = $derived(intro.drawn(gs.dealer) ?? drawnOf(gs))

  /** The discard everyone is looking at, still lying in its owner's rows. */
  const thrown = $derived(gs.last?.type === 'discard' && live && gs.last.kind !== null ? { seat: gs.last.seat, kind: gs.last.kind } : null)

  const CALLS: Record<string, string> = { chi: 'Chow 吃', peng: 'Pung 碰', gang: 'Kong 杠', hu: 'Win 胡' }
  const call = $derived(gs.last && CALLS[gs.last.type] ? { where: rel(gs.last.seat), text: CALLS[gs.last.type] } : null)
</script>

<div class="board">
  <BoardArt />

  <Wall {gs} {me} {drawn} building={intro.stage === 'build'} mark={intro.stage === 'dice' || intro.stage === 'deal'} />

  {#each seats as s (s.seat)}
    <SeatZone {gs} seat={s.seat} rot={s.rot} isMe={seated && s.seat === me} lit={thrown?.seat === s.seat} limit={intro.dealt(s.seat, gs.dealer)} {drawn} dealing={intro.active} />
  {/each}

  <div class="centre">
    {#if live}<div class="pointer" style="transform: rotate({ROT[rel(gs.toAct)]}deg)"><span></span></div>{/if}
    {#if intro.stage === 'dice' || intro.stage === 'deal'}
      <div class="roll">
        <Dice values={openingOf(gs).dice} rollMs={ROLL_MS} />
      </div>
    {:else}
      <div class="info">
        <span class="cap">Hand {gs.handIndex + 1}/{gs.config.maxHands}</span>
        <span class="wall">{intro.active ? 136 : gs.wall.length}</span>
        <span class="cap">tiles in the wall</span>
      </div>
      {#if thrown}
        {#key tick}
          <div class="thrown">
            <Tile kind={thrown.kind} lit />
            <span class="cap">{kindName(thrown.kind)}</span>
            <span class="cap dim">from {who(thrown.seat)}</span>
          </div>
        {/key}
      {/if}
    {/if}
  </div>

  {#if call}
    {#key tick}
      <div class="callout at{call.where}">{call.text}</div>
    {/key}
  {/if}
</div>

<style>
  .board { --b: min(100vw - 8px, 100dvh - 15rem, 780px); width: var(--b); height: var(--b); position: relative; container-type: inline-size; margin: 0 auto; flex: none; }
  /* the centre plate: dark lacquer with a double gold edge */
  .centre { position: absolute; left: 34.9cqw; top: 34.9cqw; width: 30.2cqw; height: 30.2cqw; border-radius: 2.2cqw; background: radial-gradient(ellipse at 50% 30%, #3a1a14 0%, #1d0c09 70%); border: 0.35cqw solid #c79a3a; box-shadow: inset 0 0 0 0.5cqw #1d0c09, inset 0 0 0 0.65cqw rgb(236 208 126 / 0.55), inset 0 0 4cqw rgb(0 0 0 / 0.6), 0 0.8cqw 2cqw rgb(0 0 0 / 0.5); display: flex; align-items: center; justify-content: center; gap: 1.6cqw; padding: 1.8cqw; z-index: 2; }
  .info, .thrown { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.2cqw; min-width: 0; }
  .cap { font-size: clamp(8.5px, 1.9cqw, 13px); line-height: 1.15; color: var(--smoke); letter-spacing: 0.02em; }
  .cap.dim { opacity: 0.75; max-width: 14cqw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wall { font-family: var(--font-brush); font-size: clamp(20px, 7.4cqw, 56px); line-height: 0.95; text-shadow: 0 0.2cqw 0.6cqw rgb(0 0 0 / 0.6); color: var(--brass-hi); font-variant-numeric: tabular-nums; }
  /* the big readable copy appears as the thrown tile lands */
  .thrown { --tw: 9cqw; animation: show 570ms ease-out 600ms both; }
  .thrown .cap { color: var(--on-felt); }

  /* a brass bar on the centre plate's edge, on the side of whoever must act */
  .pointer { position: absolute; inset: 0; pointer-events: none; transition: transform 260ms ease; }
  .pointer span { position: absolute; left: 18%; right: 18%; bottom: -0.5cqw; height: 0.9cqw; border-radius: 1cqw; background: var(--brass-hi); box-shadow: 0 0 2cqw var(--brass-hi); animation: pulse 1.4s ease-in-out infinite; }

  .callout { position: absolute; z-index: 8; transform: translate(-50%, -50%); font-family: var(--font-brush); font-weight: 400; font-size: clamp(24px, 8.6cqw, 64px); line-height: 1; white-space: nowrap; color: #fff4d6; text-shadow: 0 0.25cqw 0 rgb(0 0 0 / 0.35); background: linear-gradient(170deg, #b3261e, #7a1712); border: 0.45cqw solid var(--brass-hi); border-radius: 1.6cqw; padding: 1.2cqw 3cqw 1.6cqw; box-shadow: inset 0 0 0 0.3cqw #7a1712, inset 0 0 0 0.45cqw rgb(236 208 126 / 0.6), 0 6px 18px rgb(0 0 0 / 0.55); pointer-events: none; animation: stamp 2250ms ease-out both; }
  .at0 { left: 50%; top: 76%; }
  .at1 { left: 76%; top: 50%; }
  .at2 { left: 50%; top: 24%; }
  .at3 { left: 24%; top: 50%; }

  @keyframes show { from { opacity: 0; transform: scale(1.5); } to { opacity: 1; transform: none; } }
  @keyframes pulse { 50% { opacity: 0.45; } }
  @keyframes stamp {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(2.2) rotate(-8deg); }
    14% { opacity: 1; transform: translate(-50%, -50%) scale(0.94) rotate(-4deg); }
    22% { transform: translate(-50%, -50%) scale(1) rotate(-4deg); }
    78% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(-4deg); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.05) rotate(-4deg); }
  }
</style>
