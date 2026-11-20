<script lang="ts">
  import { kindName } from '../engine'
  import { tileSvg } from '../tiles'

  let { kind, lit = false }: { kind: number; lit?: boolean } = $props()
</script>

<span class="tile" class:lit title={kind < 0 ? '' : kindName(kind)}>{@html tileSvg(kind)}</span>

<style>
  .tile { display: block; width: var(--tw, 40px); flex: none; line-height: 0; border-radius: calc(var(--tw, 40px) * 0.12); box-shadow: 0 calc(var(--tw, 40px) * 0.06) 0 #6f6650, 0 2px 4px rgb(0 0 0 / 0.35); }
  .tile :global(svg) { width: 100%; height: auto; display: block; }
  .tile.lit { outline: 2px solid var(--brass-hi); outline-offset: 1px; }
</style>
