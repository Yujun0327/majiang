<script lang="ts">
  import { CAP_POINTS, HAND_CHOICES, POINT_VALUES, type OnlineSession } from '../app/session.svelte'
  import { savePlayerName } from '../app/persist'
  import { BOT_NAMES, SEATS } from '../engine'

  interface Props {
    session: OnlineSession
    onExit: () => void
  }

  let { session, onExit }: Props = $props()

  let copied = $state(false)
  let relays = $state(0)
  let waitedLong = $state(false)

  $effect(() => {
    const poll = setInterval(() => (relays = session.relayCount()), 1500)
    const slow = setTimeout(() => (waitedLong = true), 12000)
    return () => {
      clearInterval(poll)
      clearTimeout(slow)
    }
  })

  const mySeatEntry = $derived(session.seats.find((s) => s.playerKey === session.myKey))
  const humans = $derived(session.seats.length)
  const fmt = (v: number) => v.toLocaleString()

  async function copyInvite() {
    const url = `${location.origin}${location.pathname}#room=${session.room}`
    try {
      await navigator.clipboard.writeText(url)
      copied = true
      setTimeout(() => (copied = false), 1600)
    } catch {}
  }

  function rename(e: Event) {
    const name = (e.target as HTMLInputElement).value
    savePlayerName(name)
    session.rename(name)
  }
</script>

<main class="lobby">
  <section class="card panel">
    <h1>The table is open</h1>

    <div class="code-row">
      <span class="label">Room</span>
      <span class="code">{session.room}</span>
      <button class="btn btn--quiet dark" onclick={copyInvite}>{copied ? 'Copied' : 'Copy invite'}</button>
    </div>

    {#if session.status === 'room-full'}
      <p class="hint">All four seats at this table are taken.</p>
    {:else}
      <ul class="seats">
        {#each { length: SEATS } as _, i (i)}
          {@const seat = session.seats[i]}
          <li class="seat" class:open={!seat}>
            {#if seat}
              <span class="dot" class:on={seat.connected}></span>
              {#if seat.playerKey === session.myKey}
                <input class="name-input" type="text" maxlength="14" value={seat.name} onchange={rename} aria-label="your name" />
              {:else}
                <span class="name">{seat.name}</span>
              {/if}
              {#if seat.playerKey === session.hostKey}<span class="label">host</span>{/if}
              {#if session.buyIn > 0 && session.balances[seat.playerKey] !== undefined}
                <span class="label cash tabular" class:short={session.balances[seat.playerKey] < session.buyIn}>{fmt(session.balances[seat.playerKey])}</span>
              {/if}
              <span class="ready" class:yes={seat.ready}>{seat.ready ? 'Ready' : 'Not ready'}</span>
            {:else}
              <span class="dot"></span>
              <span class="name empty">{BOT_NAMES[i]} <span class="label">bot, unless a friend sits</span></span>
            {/if}
          </li>
        {/each}
      </ul>

      {#if session.isHost}
        <div class="picks">
          <span class="label">Hands</span>
          <div class="seg" role="group" aria-label="hands">
            {#each HAND_CHOICES as n (n)}
              <button class="btn" class:btn--gold={session.hostMaxHands === n} onclick={() => (session.hostMaxHands = n)}>{n} 局</button>
            {/each}
          </div>
          {#if POINT_VALUES.length}
            <span class="label">Stakes (four humans only)</span>
            <div class="seg" role="group" aria-label="stakes">
              <button class="btn" class:btn--gold={session.hostPointValue === 0} onclick={() => (session.hostPointValue = 0)}>Just for fun</button>
              {#each POINT_VALUES as v (v)}
                <button class="btn" class:btn--gold={session.hostPointValue === v} onclick={() => (session.hostPointValue = v)}>{fmt(v)} / point</button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
      <p class="hint">
        {session.hostMaxHands} hands.
        {#if session.buyIn > 0 && humans === SEATS}
          {fmt(session.hostPointValue)} cash a point, buy-in {fmt(session.buyIn)} ({CAP_POINTS} points), locked from your wallet on the first deal.
        {:else if session.buyIn > 0}
          Stakes apply only with four humans; with bots at the table it is played for points.
        {:else}
          Played for points, nothing leaves your wallet.
        {/if}
      </p>

      <div class="actions">
        {#if mySeatEntry}
          <button class="btn" class:btn--gold={!mySeatEntry.ready} disabled={!mySeatEntry.ready && !session.canAfford} onclick={() => session.setReady(!mySeatEntry.ready)}>
            {mySeatEntry.ready ? 'Not ready after all' : "I'm in"}
          </button>
        {/if}
        {#if session.isHost}
          <button class="btn btn--gold" disabled={!session.canStart} onclick={() => session.startGame()}>
            {humans < SEATS ? `Deal with ${SEATS - humans} bot${SEATS - humans > 1 ? 's' : ''}` : 'Deal'}
          </button>
        {/if}
        <button class="btn btn--quiet dark" onclick={onExit}>Leave</button>
      </div>

      <p class="hint">
        {#if !session.canAfford}
          You need {fmt(session.buyIn)} to sit here. Collect today's cash on the portal or ask the host for smaller stakes.
        {:else if session.status === 'connecting' && humans <= 1 && !session.isHost}
          <span class="dot" class:on={relays > 0}></span>
          {relays > 0 ? `Connected to ${relays} of ${session.brokerCount()} brokers.` : 'Reaching the game network…'} Waiting for the host.
          {#if waitedLong}<button class="btn btn--quiet dark" onclick={() => session.rescan()}>Retry connection</button>{/if}
        {:else if session.isHost}
          <span class="dot" class:on={relays > 0}></span>
          Deal whenever everyone here is in; empty seats go to the computer. Friends who open the invite appear above.
        {:else}
          The host deals when everyone is in.
        {/if}
      </p>
    {/if}
  </section>
</main>

<style>
  .lobby { min-height: 100dvh; display: grid; place-items: center; padding: var(--sp-5); }
  .card { padding: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-4); width: min(94vw, 500px); }
  h1 { font-size: var(--fs-xl); color: var(--ink); }
  .code-row { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
  .code { font-family: var(--font-display); font-size: var(--fs-xl); letter-spacing: 0.16em; color: var(--brass-lo); }
  .seats { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
  .seat { display: flex; align-items: center; gap: var(--sp-3); background: var(--cream-deep); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--sp-2) var(--sp-3); min-height: 46px; }
  .seat.open { opacity: 0.7; background: transparent; border-style: dashed; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--line); flex: none; }
  .dot.on { background: var(--brass); }
  .name { font-weight: 600; flex: 1; }
  .name.empty { font-weight: 400; color: var(--ink-soft); }
  .name.empty .label { text-transform: none; letter-spacing: 0; margin-left: var(--sp-2); }
  .name-input { font: inherit; font-weight: 600; color: var(--ink); background: transparent; border: none; border-bottom: 1px solid var(--line); flex: 1; min-width: 0; padding: 2px 0; min-height: 0; border-radius: 0; }
  .cash { color: var(--ink-soft); text-transform: none; }
  .cash.short { color: var(--danger); }
  .ready { font-size: var(--fs-xs); color: var(--ink-soft); }
  .ready.yes { color: var(--brass-lo); }
  .picks { display: flex; flex-direction: column; gap: var(--sp-2); }
  .seg { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
  .seg .btn { padding: 8px 14px; min-height: 38px; }
  .actions { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
  .hint { margin: 0; font-size: var(--fs-sm); color: var(--ink-soft); font-family: var(--font-body); }
  .hint .dot { display: inline-block; margin-right: 4px; }
  .dark { color: var(--ink); border-color: var(--line); }
</style>
