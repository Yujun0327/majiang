<script lang="ts">
  import { untrack } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import type { OnlineSession } from '../app/session.svelte'
  import { kindName, sameMove, waits, type Kind, type Move, type Seat } from '../engine'
  import { isMuted, play, setMuted, unlock } from './audio'
  import { dur, settle } from './motion'
  import PayoutLine from './PayoutLine.svelte'
  import Table from './Table.svelte'
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
  const names = $derived(gs.config.names)
  const who = (seat: Seat) => (seated && seat === me ? 'You' : names[seat])

  // one tick per revealed step, so the board's one-shot effects replay
  let tick = $state(0)
  $effect(() => {
    void session.shown
    tick = untrack(() => tick) + 1
  })

  const moves = $derived(session.myMoves())
  const canDiscard = $derived(new Set(moves.filter((m) => m.type === 'discard').map((m) => (m as { kind: Kind }).kind)))
  const calls = $derived(moves.filter((m) => m.type === 'hu' || m.type === 'gang' || m.type === 'peng' || m.type === 'chi' || m.type === 'pass'))
  const dealNext = $derived(moves.some((m) => m.type === 'nextHand'))
  const handOver = $derived((gs.phase === 'handOver' || gs.phase === 'over') && !session.busy)
  const last = $derived(gs.lastHand)

  // let the table show the finished hand for a beat before the result sheet covers it
  let sheet = $state(false)
  $effect(() => {
    if (!handOver) {
      sheet = false
      return
    }
    const t = setTimeout(() => (sheet = true), dur(1700))
    return () => clearTimeout(t)
  })

  /** My concealed tiles, the freshly drawn one set apart on the right. */
  const myHand = $derived.by(() => {
    const tiles = [...gs.hands[me]]
    const mine = gs.toAct === me && gs.phase === 'turn' && gs.drawn !== null && gs.drawn >= 0
    if (!mine) return { tiles, drawn: null as Kind | null }
    tiles.splice(tiles.indexOf(gs.drawn!), 1)
    return { tiles, drawn: gs.drawn }
  })

  /** The tiles each call would lay down, for the buttons. */
  function setOf(m: Move): Kind[] {
    const k = gs.pending?.kind
    if (m.type === 'chi' && k !== undefined) return [...m.use, k].sort((a, b) => a - b)
    if (m.type === 'peng' && k !== undefined) return [k, k, k]
    if (m.type === 'gang') return [m.kind, m.kind, m.kind, m.kind]
    return []
  }

  /** While I am being offered a tile, the tiles in my hand that could take it stand up. */
  const hinted = $derived.by(() => {
    const out = new Set<Kind>()
    if (gs.phase !== 'claim' || !gs.pending) return out
    for (const m of calls) {
      if (m.type === 'chi') m.use.forEach((k) => out.add(k))
      else if (m.type === 'peng' || m.type === 'gang') out.add(gs.pending.kind)
    }
    return out
  })

  /** One tile from winning: the tiles that would finish my hand. */
  const ready = $derived(seated && (gs.phase === 'turn' || gs.phase === 'claim') ? waits(gs.hands[me], gs.melds[me].length) : [])

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
    if (session.status === 'desync') return 'Out of sync with the table — waiting for a repair…'
    if (session.absentSeat !== null && !takeover) return `${names[session.absentSeat]} is away, waiting for them to reconnect…`
    if (session.busy) return 'The others are playing…'
    if (gs.phase === 'claim' && gs.pending) {
      if (calls.length) return `${who(gs.pending.from)} threw ${kindName(gs.pending.kind)} — do you want it?`
      return `Waiting for ${who(gs.toAct)} to call or pass`
    }
    if (gs.phase === 'turn') {
      if (gs.toAct === me && seated) return gs.mustDiscard ? 'Now throw one — tap a tile, tap it again' : 'Your turn — tap a tile, tap it again to throw it'
      return `Waiting for ${who(gs.toAct)} to throw a tile`
    }
    return ''
  })

  function callLabel(m: Move): string {
    if (m.type === 'hu') return gs.phase === 'turn' ? 'Win 胡 (self-draw)' : 'Win 胡'
    if (m.type === 'gang') return 'Kong 杠'
    if (m.type === 'peng') return 'Pung 碰'
    if (m.type === 'pass') return 'Pass'
    return 'Chow 吃'
  }

  const resultTitle = $derived.by(() => {
    if (!last) return ''
    if (last.how === 'draw') return 'Draw — the wall ran out'
    if (last.how === 'zimo') return `Winner: ${who(last.winner!)} · self-draw`
    return `Winner: ${who(last.winner!)} · ${last.how === 'rob' ? 'robbed the kong of' : 'on the discard of'} ${who(last.from!)}`
  })
  const standings = $derived(gs.scores.map((score, seat) => ({ seat, score })).sort((a, b) => b.score - a.score))
  const signed = (v: number) => (v > 0 ? '+' : '') + v
</script>

<main class="screen">
  <header class="bar">
    <span class="label">Room {session.room}</span>
    {#if !seated}<span class="label">spectating</span>{/if}
    <span class="grow"></span>
    <button class="chip" onclick={() => { muted = !muted; setMuted(muted) }} aria-pressed={!muted}>{muted ? 'Sound off' : 'Sound on'}</button>
    <button class="chip" onclick={onExit}>Leave</button>
  </header>

  <Table {gs} {me} {seated} {tick} />

  <section class="mine">
    {#if ready.length}
      <div class="ready">
        <span>One tile from winning — waiting for</span>
        <span class="run">{#each ready as k (k)}<Tile kind={k} />{/each}</span>
      </div>
    {/if}

    <p class="status" class:mine-turn={calls.length > 0 || (seated && gs.toAct === me && gs.phase === 'turn' && !session.busy)}>{status}</p>

    {#if takeover}
      <div class="actions">
        <button class="btn" onclick={() => submit(takeover)}>{names[session.absentSeat!]} is away — let the bot play for them</button>
      </div>
    {/if}

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
            {#if setOf(m).length}
              <span class="run">{#each setOf(m) as k, j (j)}<Tile kind={k} />{/each}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    {#if seated}
      <div class="hand">
        {#each myHand.tiles as k, i (i)}
          <button class="slot" class:up={picked === i} class:hint={hinted.has(k)} class:dead={!canDiscard.has(k)} onclick={() => tap(i, k)} aria-label={kindName(k)}>
            <Tile kind={k} />
          </button>
        {/each}
        {#if myHand.drawn !== null}
          <button class="slot drawn" class:up={picked === -1} class:dead={!canDiscard.has(myHand.drawn)} onclick={() => tap(-1, myHand.drawn!)} aria-label={kindName(myHand.drawn)} in:fly={{ y: -34, duration: dur(280), easing: settle }}>
            <Tile kind={myHand.drawn} />
          </button>
        {/if}
      </div>
    {/if}
  </section>
</main>

{#if sheet && last}
  <div class="overlay" transition:fade={{ duration: dur(200) }}>
    <div class="card panel" transition:fly={{ y: 40, duration: dur(320), easing: settle }}>
      <p class="label">Hand {last.handIndex + 1} / {gs.config.maxHands}{gs.result ? ' · final standings' : ''}</p>
      <h2>{resultTitle}</h2>
      {#if last.winner !== null}
        <div class="reveal">
          {#each gs.melds[last.winner] as m, i (i)}
            <span class="meld">{#each m.kinds as k, j (j)}<Tile kind={k} />{/each}</span>
          {/each}
          <span class="meld">{#each gs.hands[last.winner] as k, j (j)}<Tile kind={k} lit={last.tile !== null && j === gs.hands[last.winner].indexOf(last.tile)} />{/each}</span>
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
  .screen { min-height: 100dvh; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-2) 4px max(var(--sp-2), env(safe-area-inset-bottom)); max-width: 980px; margin: 0 auto; }
  .bar { display: flex; align-items: center; gap: var(--sp-3); padding: 0 var(--sp-2); min-height: 32px; }
  .grow { flex: 1; }
  .chip { background: transparent; border: 1px solid rgb(243 236 218 / 0.3); color: var(--on-felt); border-radius: 999px; padding: 4px 12px; font-size: var(--fs-xs); min-height: 30px; }

  .mine { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; gap: var(--sp-2); min-height: 9.5rem; }
  .status { margin: 0; text-align: center; color: var(--smoke); font-size: var(--fs-sm); min-height: 1.45em; }
  .status.mine-turn { color: var(--brass-hi); font-weight: 600; }
  .ready { display: flex; align-items: center; justify-content: center; gap: var(--sp-2); flex-wrap: wrap; font-size: var(--fs-xs); color: var(--on-felt); background: rgb(0 0 0 / 0.25); border: 1px solid rgb(236 208 126 / 0.45); border-radius: 999px; padding: 4px 12px; align-self: center; }
  .run { display: flex; gap: 1px; --tw: 20px; }
  .actions { display: flex; gap: var(--sp-2); flex-wrap: wrap; justify-content: center; align-items: center; }
  .call-btn { display: flex; align-items: center; gap: 8px; font-size: var(--fs-md); padding: 8px 16px; }

  .hand { --tw: clamp(22px, calc((100vw - 30px) / 14.4), 56px); display: flex; justify-content: center; align-items: flex-end; gap: 1px; padding-top: calc(var(--tw) * 0.38); }
  .slot { background: none; border: none; padding: 0; transition: transform 110ms ease, filter 110ms ease; }
  .slot.hint { transform: translateY(calc(var(--tw) * -0.18)); filter: drop-shadow(0 0 6px var(--brass-hi)); }
  .slot.up { transform: translateY(calc(var(--tw) * -0.32)); }
  .slot.dead { cursor: default; }
  .slot.drawn { margin-left: calc(var(--tw) * 0.35); }

  .overlay { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; background: rgb(0 0 0 / 0.55); padding: var(--sp-3); }
  .card { width: min(96vw, 520px); padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); max-height: 92dvh; overflow-y: auto; }
  .card h2 { font-size: var(--fs-xl); line-height: 1.2; color: var(--ink); }
  .reveal { --tw: clamp(16px, 5vw, 26px); display: flex; flex-wrap: wrap; gap: 4px 8px; }
  .meld { display: flex; gap: 1px; }
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
