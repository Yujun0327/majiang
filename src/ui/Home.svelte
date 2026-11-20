<script lang="ts">
  import { loadPlayerName, savePlayerName } from '../app/persist'
  import Modal from './Modal.svelte'
  import Tile from './Tile.svelte'
  import WalletBadge from './WalletBadge.svelte'

  interface Props {
    onCreateRoom: () => void
    onJoinRoom: (code: string) => void
  }

  let { onCreateRoom, onJoinRoom }: Props = $props()

  let code = $state('')
  let rulesOpen = $state(false)
  let myName = $state(loadPlayerName())

  function rename(e: Event) {
    myName = (e.target as HTMLInputElement).value
    savePlayerName(myName)
  }
</script>

<main class="home">
  <header class="marquee">
    <div class="fan" aria-hidden="true">
      {#each [27, 31, 0, 13, 22, 32, 33] as k (k)}<Tile kind={k} />{/each}
    </div>
    <h1><span class="foil-text">麻将</span></h1>
    <p class="label kicker">Mahjong</p>
    <p class="tag">Mahjong for four, simple rules. Friends take seats; bots fill the rest.</p>
  </header>
  <WalletBadge />

  <section class="panel block">
    <h2>Take a seat</h2>
    <label class="field">
      <span class="label">Your name</span>
      <input type="text" maxlength="14" value={myName} placeholder="name" onchange={rename} />
    </label>
    <div class="row">
      <button class="btn btn--gold" onclick={onCreateRoom}>Open a table</button>
      <form class="join" onsubmit={(e) => { e.preventDefault(); if (code.trim()) onJoinRoom(code.trim()) }}>
        <input type="text" maxlength="8" bind:value={code} placeholder="room code" aria-label="room code" />
        <button class="btn" type="submit" disabled={!code.trim()}>Join</button>
      </form>
    </div>
    <p class="hint">Open a table and start alone against three bots, or send the invite and let friends take the seats. Your tiles are yours alone — play it straight.</p>
    <div class="row">
      <button class="btn btn--quiet" onclick={() => (rulesOpen = true)}>Rules</button>
    </div>
  </section>

  <footer>
    <p>A fan-made table for friends. Play money only.</p>
    <p>build {__BUILD_STAMP__}</p>
  </footer>
</main>

{#if rulesOpen}
  <Modal onClose={() => (rulesOpen = false)}>
    <div class="rules">
      <h2>How to play</h2>
      <ul>
        <li><b>Tiles.</b> 136 in three suits numbered 1–9 — Characters (萬), Dots and Bamboo — plus the winds East 東, South 南, West 西, North 北 and the dragons Red 中, Green 發, White (the blue frame). No flowers.</li>
        <li><b>Winning (胡).</b> Four sets and a pair. A set is a run of three in one suit, three of a kind, or four of a kind. Seven pairs also wins. There is no minimum score.</li>
        <li><b>Chow (吃)</b> takes a discard to finish a run, only from the player right before you. <b>Pung (碰)</b> takes any discard for three of a kind, <b>Kong (杠)</b> for four. A win beats a pung or kong, which beat a chow.</li>
        <li>You can win on someone's discard, on your own draw, or by robbing a kong that someone adds to their pung.</li>
        <li><b>Points.</b> Win on a discard: the discarder pays 2. Win on your own draw: everyone pays 2. Concealed kong: everyone pays 2. Kong added to a pung: everyone pays 1. Kong from a discard: the discarder pays 3.</li>
        <li><b>Draw.</b> If the wall runs out nobody pays, kongs included. The winner deals the next hand; after a draw the dealer stays.</li>
      </ul>
      <button class="btn" onclick={() => (rulesOpen = false)}>Close</button>
    </div>
  </Modal>
{/if}

<style>
  .home { max-width: 40rem; margin: 0 auto; padding: 6vh var(--sp-4) var(--sp-7); display: flex; flex-direction: column; gap: var(--sp-5); }
  .marquee { text-align: center; }
  .fan { display: flex; justify-content: center; gap: 4px; --tw: clamp(30px, 9vw, 46px); margin-bottom: var(--sp-4); }
  h1 { font-size: clamp(3.6rem, 16vw, 6.4rem); line-height: 1.05; font-weight: 700; letter-spacing: 0.08em; }
  .tag { margin: var(--sp-2) 0 0; color: var(--smoke); font-family: var(--font-body); }
  .block { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); }
  .block h2 { font-size: var(--fs-lg); color: var(--ink); }
  .field { display: flex; flex-direction: column; gap: var(--sp-1); }
  .row { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: center; }
  .join { display: flex; gap: var(--sp-2); flex: 1; min-width: 12rem; }
  .join input { flex: 1; min-width: 0; text-transform: uppercase; letter-spacing: 0.12em; }
  .hint { margin: 0; color: var(--ink-soft); font-family: var(--font-body); }
  .block .btn--quiet { color: var(--ink); border-color: var(--line); }
  .rules { display: flex; flex-direction: column; gap: var(--sp-3); font-family: var(--font-body); }
  .rules ul { margin: 0; padding-left: 1.2em; display: flex; flex-direction: column; gap: var(--sp-2); }
  footer { text-align: center; color: var(--smoke); font-size: var(--fs-xs); }
  footer p { margin: var(--sp-1) 0; }
</style>
