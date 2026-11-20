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
    <p class="tag">推倒胡 for four. Friends take seats; the computer fills the rest.</p>
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
      <button class="btn btn--quiet" onclick={() => (rulesOpen = true)}>规则 · Rules</button>
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
      <h2>推倒胡</h2>
      <ul>
        <li>136 tiles: 万 筒 条 plus winds and dragons. No flowers.</li>
        <li><b>胡</b> with four melds and a pair — any mix of runs, triplets and 杠 — or with seven pairs (七对). No minimum.</li>
        <li><b>吃</b> only from the player before you; <b>碰</b> and <b>杠</b> from anyone. 胡 beats 碰/杠, which beat 吃.</li>
        <li>You may 胡 on a discard (点炮) or rob an added 杠 (抢杠胡).</li>
        <li><b>Points.</b> 点炮: the discarder pays 2. 自摸: everyone pays 2. 暗杠: everyone pays 2. 补杠: everyone pays 1. 明杠: the discarder pays 3.</li>
        <li>流局 (the wall runs out): nobody pays, 杠 included. The winner deals next; after a draw the dealer stays.</li>
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
