<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import type { OnlineSession } from '../app/session.svelte'
  import { SEATS, kindName, sameMove, type Kind, type Meld, type Move, type Seat } from '../engine'
  import { isMuted, play, setMuted, unlock } from './audio'
  import { dur, settle } from './motion'
  import PayoutLine from './PayoutLine.svelte'
  import Tile from './Tile.svelte'

  interface Props {
    session: OnlineSession
    onExit: () => void
    onRematch: () => void
  }

  let { session, onExit, onRematch }: Props = $props()

  const gs = $derived(session.view)
  const seated = $derived(session.mySeat !== null)
  const me = $derived(session.mySeat ?? 0)
  /** Across the top, left to right: the player before me, across, and after me. */
  const opponents = $derived([3, 2, 1].map((d) => ({ seat: (me + d) % SEATS, rel: ['', 'plays after you', 'across', 'plays before you'][d] })))
  const names = $derived(gs.config.names)
  const who = (seat: Seat) => (seated && seat === me ? 'You' : names[seat])

  const moves = $derived(session.myMoves())
  const canDiscard = $derived(new Set(moves.filter((m) => m.type === 'discard').map((m) => (m as { kind: Kind }).kind)))
  const calls = $derived(moves.filter((m) => m.type === 'hu' || m.type === 'gang' || m.type === 'peng' || m.type === 'chi' || m.type === 'pass'))
  const dealNext = $derived(moves.some((m) => m.type === 'nextHand'))
  const handOver = $derived((gs.phase === 'handOver' || gs.phase === 'over') && !session.busy)
  const last = $derived(gs.lastHand)

  /** My concealed tiles, the freshly drawn one set apart on the right. */
  const myHand = $derived.by(() => {
    const tiles = [...gs.hands[me]]
    const mine = gs.toAct === me && gs.phase === 'turn' && gs.drawn !== null && gs.drawn >= 0
    if (!mine) return { tiles, drawn: null as Kind | null }
    tiles.splice(tiles.indexOf(gs.drawn!), 1)
    return { tiles, drawn: gs.drawn }
  })

  let picked = $state<number | null>(null)
  let muted = $state(isMuted())
  $effect(() => {
    void gs.hands[me].length
    void gs.toAct
    picked = null
  })

  function submit(move: Move) {
    unlock()
    if (moves.some((m) => sameMove(m, move))) session.submit(move)
  }

  /** First tap lifts a tile, the second throws it. `slot` is its place in the row (drawn tile = -1). */
  function tap(slot: number, kind: Kind) {
    unlock()
    if (!canDiscard.has(kind)) return
    if (picked === slot) submit({ type: 'discard', kind })
    else picked = slot
  }

  let lastSfx = -1
  $effect(() => {
    const e = session.events.at(-1)
    if (e && e.id !== lastSfx) {
      lastSfx = e.id
      play(e.sfx)
    }
  })

  // an absent player holding up the table may be handed to the bot after a while
  let absentFor = $state(0)
  $effect(() => {
    const seat = session.absentSeat
    absentFor = 0
    if (seat === null) return
    const t = setInterval(() => absentFor++, 1000)
    return () => clearInterval(t)
  })
  const takeover = $derived(
    session.absentSeat !== null && absentFor >= 30 ? moves.find((m) => m.type === 'takeover' && m.seat === session.absentSeat) : undefined,
  )

  const status = $derived.by(() => {
    if (session.busy) return ''
    if (gs.phase === 'claim' && gs.pending) {
      if (calls.length) return `${kindName(gs.pending.kind)} from ${who(gs.pending.from)} — do you want it?`
      return `Waiting for ${who(gs.toAct)} to call or pass`
    }
    if (gs.phase === 'turn') {
      if (gs.toAct === me && seated) return gs.mustDiscard ? 'Discard a tile — tap to lift, tap again to throw' : 'Your turn — tap a tile to lift it, tap again to discard'
      return `Waiting for ${who(gs.toAct)} to discard`
    }
    return ''
  })

  const lastLine = $derived.by(() => {
    const l = gs.last
    if (!l) return ''
    const verb: Record<string, string> = { discard: 'Discard', chi: 'Chow 吃', peng: 'Pung 碰', gang: 'Kong 杠', hu: 'Win 胡' }
    return verb[l.type] ? `${who(l.seat)} · ${verb[l.type]}${l.kind !== null && l.kind >= 0 ? ' · ' + kindName(l.kind) : ''}` : ''
  })

  /** The discard everyone is looking at: lit in its owner's pool. */
  const litSeat = $derived(gs.last?.type === 'discard' && gs.phase !== 'handOver' ? gs.last.seat : null)

  function callLabel(m: Move): string {
    if (m.type === 'hu') return gs.phase === 'turn' ? 'Win 胡 (self-draw)' : 'Win 胡'
    if (m.type === 'gang') return calls.filter((c) => c.type === 'gang').length > 1 ? `Kong 杠 · ${kindName(m.kind)}` : 'Kong 杠'
    if (m.type === 'peng') return 'Pung 碰'
    if (m.type === 'pass') return 'Pass'
    return 'Chow 吃'
  }

  /** Another player's 暗杠 stays face down until the hand is over. */
  const meldTiles = (m: Meld): Kind[] => (m.concealed && gs.phase !== 'handOver' && gs.phase !== 'over' ? m.kinds.map(() => -1) : m.kinds)
  const resultTitle = $derived.by(() => {
    if (!last) return ''
    if (last.how === 'draw') return 'Draw — the wall ran out'
    if (last.how === 'zimo') return `Winner: ${who(last.winner!)} · self-draw`
    return `Winner: ${who(last.winner!)} · ${last.how === 'rob' ? 'robbed the kong of' : 'on the discard of'} ${who(last.from!)}`
  })
  const standings = $derived(gs.scores.map((score, seat) => ({ seat, score })).sort((a, b) => b.score - a.score))
  const signed = (v: number) => (v > 0 ? '+' : '') + v
</script>

<main class="table">
  <header class="bar">
    <span class="label">Room {session.room}</span>
    <span class="label tabular">Hand {gs.handIndex + 1} / {gs.config.maxHands} · {gs.wall.length} tiles left</span>
    <span class="grow"></span>
    <button class="chip" onclick={() => { muted = !muted; setMuted(muted) }} aria-pressed={!muted}>{muted ? 'Sound off' : 'Sound on'}</button>
    <button class="chip" onclick={onExit}>Leave</button>
  </header>

  <section class="opps">
    {#each opponents as o (o.seat)}
      <div class="opp" class:turn={gs.toAct === o.seat && !gs.result && gs.phase !== 'handOver'}>
        <div class="who">
          <span class="name">{names[o.seat]}</span>
          {#if gs.dealer === o.seat}<span class="zhuang">Dealer</span>{/if}
          {#if gs.autopilot[o.seat]}<span class="label">bot playing</span>{/if}
        </div>
        <div class="meta label tabular">{o.rel} · {gs.hands[o.seat].length} tiles · {signed(gs.scores[o.seat])} pts</div>
        {#if gs.melds[o.seat].length}
          <div class="melds small">
            {#each gs.melds[o.seat] as m, i (i)}
              <span class="meld">{#each meldTiles(m) as k, j (j)}<Tile kind={k} />{/each}</span>
            {/each}
          </div>
        {/if}
        <div class="pool small">
          {#each gs.discards[o.seat] as k, i (i)}
            <Tile kind={k} lit={litSeat === o.seat && i === gs.discards[o.seat].length - 1} />
          {/each}
        </div>
      </div>
    {/each}
  </section>

  <section class="centre">
    {#if lastLine}<p class="call">{lastLine}</p>{/if}
    <p class="status">{status}</p>
    {#if takeover}
      <button class="btn" onclick={() => submit(takeover)}>{names[session.absentSeat!]} is away — let the bot play for them</button>
    {:else if session.absentSeat !== null}
      <p class="status">{names[session.absentSeat]} is away, waiting for them to reconnect…</p>
    {/if}
    {#if session.status === 'desync'}<p class="status">Out of sync with the table — waiting for a repair…</p>{/if}
  </section>

  <section class="mine" class:turn={seated && gs.toAct === me && gs.phase === 'turn'}>
    <div class="pool small own">
      {#each gs.discards[me] as k, i (i)}
        <Tile kind={k} lit={litSeat === me && i === gs.discards[me].length - 1} />
      {/each}
    </div>

    <div class="myline">
      <span class="name">{names[me]}</span>
      {#if gs.dealer === me}<span class="zhuang">Dealer</span>{/if}
      <span class="label tabular">{signed(gs.scores[me])} pts</span>
      {#if !seated}<span class="label">spectating</span>{/if}
      <span class="grow"></span>
      {#if gs.melds[me].length}
        <div class="melds small">
          {#each gs.melds[me] as m, i (i)}
            <span class="meld">{#each m.kinds as k, j (j)}<Tile kind={k} />{/each}</span>
          {/each}
        </div>
      {/if}
    </div>

    {#if seated && gs.autopilot[me]}
      <div class="actions">
        <span class="status">The bot is playing for you</span>
        <button class="btn btn--gold" onclick={() => submit({ type: 'resume' })}>I'm back</button>
      </div>
    {:else if calls.length}
      <div class="actions" transition:fly={{ y: 10, duration: dur(160) }}>
        {#each calls as m, i (i)}
          <button class="btn call-btn" class:btn--gold={m.type === 'hu'} class:btn--quiet={m.type === 'pass'} onclick={() => submit(m)}>
            <span>{callLabel(m)}</span>
            {#if m.type === 'chi' && gs.pending}
              <span class="run">{#each [...m.use, gs.pending.kind].sort((a, b) => a - b) as k, j (j)}<Tile kind={k} />{/each}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    <div class="hand">
      {#each myHand.tiles as k, i (i)}
        <button class="slot" class:up={picked === i} class:dead={seated && !canDiscard.has(k)} disabled={!seated} onclick={() => tap(i, k)} aria-label={kindName(k)}>
          <Tile kind={k} />
        </button>
      {/each}
      {#if myHand.drawn !== null}
        <button class="slot drawn" class:up={picked === -1} class:dead={!canDiscard.has(myHand.drawn)} onclick={() => tap(-1, myHand.drawn!)} aria-label={kindName(myHand.drawn)}>
          <Tile kind={myHand.drawn} />
        </button>
      {/if}
    </div>
  </section>
</main>

{#if handOver && last}
  <div class="overlay" transition:fade={{ duration: dur(200) }}>
    <div class="card panel" transition:fly={{ y: 40, duration: dur(320), easing: settle }}>
      <p class="label">Hand {last.handIndex + 1} / {gs.config.maxHands}{gs.result ? ' · final standings' : ''}</p>
      <h2>{resultTitle}</h2>
      {#if last.winner !== null}
        <div class="reveal small">
          {#each gs.melds[last.winner] as m, i (i)}
            <span class="meld">{#each m.kinds as k, j (j)}<Tile kind={k} />{/each}</span>
          {/each}
          <span class="meld">{#each gs.hands[last.winner] as k, j (j)}<Tile kind={k} lit={k === last.tile} />{/each}</span>
        </div>
      {/if}
      <ol class="rows">
        {#each standings as row (row.seat)}
          <li class:me={seated && row.seat === me}>
            <span class="rname">{names[row.seat]}</span>
            <span class="tabular delta" class:plus={last.delta[row.seat] > 0} class:minus={last.delta[row.seat] < 0}>{signed(last.delta[row.seat])}</span>
            <span class="tabular total">{signed(row.score)}</span>
          </li>
        {/each}
      </ol>
      {#if gs.result}
        <PayoutLine payout={session.payout} lock={session.lockState} />
        <div class="actions">
          {#if seated}<button class="btn btn--gold" onclick={onRematch}>Play again</button>{/if}
          <button class="btn" onclick={onExit}>Leave</button>
        </div>
      {:else if dealNext}
        <div class="actions"><button class="btn btn--gold" onclick={() => submit({ type: 'nextHand' })}>Next hand</button></div>
      {:else}
        <p class="wait">Waiting for {names[gs.toAct]} to deal the next hand…</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .table { min-height: 100dvh; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-2) var(--sp-2) max(var(--sp-2), env(safe-area-inset-bottom)); max-width: 980px; margin: 0 auto; }
  .bar { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
  .grow { flex: 1; }
  .chip { background: transparent; border: 1px solid rgb(243 236 218 / 0.3); color: var(--on-felt); border-radius: 999px; padding: 4px 12px; font-size: var(--fs-xs); min-height: 30px; }

  .small { --tw: clamp(15px, 4.1vw, 28px); }
  .opps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--sp-2); align-items: start; }
  .opp { background: rgb(0 0 0 / 0.2); border: 1px solid rgb(243 236 218 / 0.12); border-radius: var(--radius); padding: var(--sp-2); display: flex; flex-direction: column; gap: 6px; min-height: 9.5rem; }
  .opp.turn, .mine.turn { border-color: var(--brass-hi); box-shadow: 0 0 0 1px var(--brass-hi), 0 0 18px rgb(236 208 126 / 0.25); }
  .who, .myline { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .zhuang { flex: none; background: var(--oxblood); color: var(--cream); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1; padding: 3px 5px; border-radius: 4px; }
  .card h2 { line-height: 1.2; }
  .meta { text-transform: none; letter-spacing: 0; }
  .pool { display: flex; flex-wrap: wrap; gap: 2px 1px; align-content: flex-start; }
  .pool.own { min-height: calc(var(--tw) * 1.4); justify-content: center; }
  .melds, .reveal { display: flex; flex-wrap: wrap; gap: 4px 8px; }
  .meld { display: flex; gap: 1px; }

  .centre { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-2); text-align: center; min-height: 4.5rem; }
  .call { margin: 0; font-family: var(--font-display); font-size: var(--fs-lg); color: var(--brass-hi); }
  .status { margin: 0; color: var(--smoke); font-size: var(--fs-sm); min-height: 1.45em; }

  .mine { border: 1px solid transparent; border-radius: var(--radius); padding: var(--sp-2) 0; display: flex; flex-direction: column; gap: var(--sp-2); }
  .myline { padding: 0 var(--sp-2); flex-wrap: wrap; }
  .actions { display: flex; gap: var(--sp-2); flex-wrap: wrap; justify-content: center; align-items: center; }
  .call-btn { display: flex; align-items: center; gap: 8px; font-size: var(--fs-md); padding: 8px 18px; }
  .call-btn .run { display: flex; gap: 1px; --tw: 20px; }
  .hand { --tw: clamp(22px, calc((100vw - 30px) / 14.4), 56px); display: flex; justify-content: center; align-items: flex-end; gap: 1px; padding-top: calc(var(--tw) * 0.35); }
  .slot { background: none; border: none; padding: 0; transition: transform 110ms ease; }
  .slot.up { transform: translateY(calc(var(--tw) * -0.3)); }
  .slot.dead { cursor: default; }
  .slot.drawn { margin-left: calc(var(--tw) * 0.35); }
  .slot:disabled { cursor: default; }

  .overlay { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; background: rgb(0 0 0 / 0.55); padding: var(--sp-3); }
  .card { width: min(96vw, 520px); padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); max-height: 92dvh; overflow-y: auto; }
  .card h2 { font-size: var(--fs-xl); color: var(--ink); }
  .reveal { --tw: clamp(16px, 5vw, 26px); }
  .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .rows li { display: flex; gap: var(--sp-3); border-top: 1px solid var(--line); padding: 6px 0; font-family: var(--font-body); }
  .rows li.me .rname { color: var(--brass-lo); }
  .rname { flex: 1; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .delta { min-width: 3em; text-align: right; color: var(--ink-soft); }
  .delta.plus { color: #1f6f43; }
  .delta.minus { color: var(--danger); }
  .total { min-width: 3.5em; text-align: right; font-weight: 600; }
  .wait { margin: 0; color: var(--ink-soft); font-style: italic; }
</style>
