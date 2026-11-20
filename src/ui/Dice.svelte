<script lang="ts">
  import { motionOk } from './motion'

  /** Two dice that tumble, then settle on `values`. */
  let { values, rollMs = 1100 }: { values: [number, number]; rollMs?: number } = $props()

  let shown = $state<[number, number]>([1, 1])
  let rolling = $state(true)

  $effect(() => {
    const final = values
    if (!motionOk()) {
      shown = final
      rolling = false
      return
    }
    rolling = true
    const spin = setInterval(() => (shown = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]), 130)
    const stop = setTimeout(() => {
      clearInterval(spin)
      shown = final
      rolling = false
    }, rollMs)
    return () => {
      clearInterval(spin)
      clearTimeout(stop)
    }
  })

  /** Pip positions on a 3×3 grid, by face. */
  const PIPS: number[][] = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]]
</script>

<div class="dice" class:rolling aria-label="dice: {values[0]} and {values[1]}">
  {#each shown as v, i (i)}
    <span class="die d{i}">
      {#each { length: 9 } as _, p (p)}<i class:on={PIPS[v].includes(p)} class:red={v === 1 || v === 4}></i>{/each}
    </span>
  {/each}
</div>

<style>
  .dice { display: flex; gap: 2.2cqw; justify-content: center; }
  .die { width: 9cqw; height: 9cqw; border-radius: 1.6cqw; background: linear-gradient(145deg, #fffaf0, #e4dac2); box-shadow: 0 0.5cqw 0 #8a7f66, 0 1cqw 1.6cqw rgb(0 0 0 / 0.5); display: grid; grid-template-columns: repeat(3, 1fr); padding: 1.1cqw; gap: 0.3cqw; }
  .die i { border-radius: 50%; }
  .die i.on { background: #1c1a17; }
  .die i.on.red { background: #b3261e; }
  .rolling .die { animation: tumble 420ms linear infinite; }
  .rolling .d1 { animation-duration: 500ms; animation-direction: reverse; }
  .dice:not(.rolling) .die { animation: land 420ms ease-out both; }
  @keyframes tumble { 0% { transform: translate(-1.2cqw, -1.6cqw) rotate(0deg); } 50% { transform: translate(1.2cqw, 0.6cqw) rotate(180deg); } 100% { transform: translate(-1.2cqw, -1.6cqw) rotate(360deg); } }
  @keyframes land { from { transform: scale(1.35); } 60% { transform: scale(0.94); } to { transform: none; } }
</style>
