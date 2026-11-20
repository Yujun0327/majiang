<script lang="ts">
  import { SEATS, kindName, type GameState, type Seat } from '../engine'
  import SeatZone from './SeatZone.svelte'
  import Tile from './Tile.svelte'

  interface Props {
    gs: GameState
    /** The seat drawn at the bottom. */
    me: Seat
    seated: boolean
    /** Changes with every revealed step, so one-shot effects replay. */
    tick: number
  }

  let { gs, me, seated, tick }: Props = $props()

  /** Layer rotation by how many seats after me: me, right, across, left. */
  const ROT = [0, -90, 180, 90]
  const rel = (seat: Seat) => (seat - me + SEATS) % SEATS
  const seats = $derived([0, 1, 2, 3].map((d) => ({ seat: (me + d) % SEATS, rot: ROT[d] })))
  const live = $derived(gs.phase === 'turn' || gs.phase === 'claim')
  const who = (seat: Seat) => (seated && seat === me ? 'you' : gs.config.names[seat])

  /** The discard everyone is looking at, still lying in its owner's river. */
  const thrown = $derived(gs.last?.type === 'discard' && live && gs.last.kind !== null ? { seat: gs.last.seat, kind: gs.last.kind } : null)

  const CALLS: Record<string, string> = { chi: 'Chow 吃', peng: 'Pung 碰', gang: 'Kong 杠', hu: 'Win 胡' }
  const call = $derived(gs.last && CALLS[gs.last.type] ? { where: rel(gs.last.seat), text: CALLS[gs.last.type] } : null)
</script>

<div class="board">
  <div class="felt"></div>

  {#each seats as s (s.seat)}
    <SeatZone {gs} seat={s.seat} rot={s.rot} isMe={seated && s.seat === me} lit={thrown?.seat === s.seat} />
  {/each}

  <div class="centre">
    {#if live}<div class="pointer" style="transform: rotate({ROT[rel(gs.toAct)]}deg)"><span></span></div>{/if}
    <div class="info">
      <span class="cap">Hand {gs.handIndex + 1}/{gs.config.maxHands}</span>
      <span class="wall">{gs.wall.length}</span>
      <span class="cap">tiles left</span>
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
  </div>

  {#if call}
    {#key tick}
      <div class="callout at{call.where}">{call.text}</div>
    {/key}
  {/if}
</div>

<style>
  .board { --b: min(100vw - 8px, 100dvh - 15rem, 780px); width: var(--b); height: var(--b); position: relative; container-type: inline-size; margin: 0 auto; flex: none; }
  .felt { position: absolute; inset: 0; border-radius: 3cqw; background: radial-gradient(ellipse at 50% 45%, #1f6a57 0%, #14503f 55%, #0d3a2f 100%); box-shadow: inset 0 0 0 0.9cqw #5a3a28, inset 0 0 0 1.1cqw #2a170d, inset 0 0 6cqw rgb(0 0 0 / 0.45), 0 6px 18px rgb(0 0 0 / 0.5); }
  .felt::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background-image: var(--grain); opacity: 0.18; mix-blend-mode: multiply; }

  .centre { position: absolute; left: 34.5cqw; top: 34.5cqw; width: 31cqw; height: 31cqw; border-radius: 2cqw; background: rgb(0 0 0 / 0.3); border: 1px solid rgb(243 236 218 / 0.16); display: flex; align-items: center; justify-content: center; gap: 1.6cqw; padding: 1.4cqw; }
  .info, .thrown { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.2cqw; min-width: 0; }
  .cap { font-size: clamp(8.5px, 1.9cqw, 13px); line-height: 1.15; color: var(--smoke); letter-spacing: 0.02em; }
  .cap.dim { opacity: 0.75; max-width: 14cqw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wall { font-family: var(--font-display); font-size: clamp(18px, 6cqw, 44px); line-height: 1; color: var(--brass-hi); font-variant-numeric: tabular-nums; }
  .thrown { --tw: 9cqw; animation: show 420ms ease-out both; }
  .thrown .cap { color: var(--on-felt); }

  /* a brass bar on the centre plate's edge, on the side of whoever must act */
  .pointer { position: absolute; inset: 0; pointer-events: none; transition: transform 260ms ease; }
  .pointer span { position: absolute; left: 18%; right: 18%; bottom: -0.5cqw; height: 0.9cqw; border-radius: 1cqw; background: var(--brass-hi); box-shadow: 0 0 2cqw var(--brass-hi); animation: pulse 1.4s ease-in-out infinite; }

  .callout { position: absolute; z-index: 8; transform: translate(-50%, -50%); font-family: var(--font-display); font-weight: 700; font-size: clamp(20px, 7cqw, 52px); line-height: 1; white-space: nowrap; color: var(--cream); background: var(--oxblood); border: 0.4cqw solid var(--brass-hi); border-radius: 1.6cqw; padding: 1.4cqw 2.6cqw; box-shadow: 0 6px 18px rgb(0 0 0 / 0.5); pointer-events: none; animation: stamp 1500ms ease-out both; }
  .at0 { left: 50%; top: 80%; }
  .at1 { left: 80%; top: 50%; }
  .at2 { left: 50%; top: 20%; }
  .at3 { left: 20%; top: 50%; }

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
