<script lang="ts">
  import { kindName } from '../engine'
  import { tileSvg } from '../tiles'

  /** `sideways` lays the tile on its side (a claimed tile inside a set). */
  let { kind, lit = false, sideways = false }: { kind: number; lit?: boolean; sideways?: boolean } = $props()
</script>

<span class="tile" class:lit class:sideways title={kind < 0 ? '' : kindName(kind)}><span class="face">{@html tileSvg(kind)}</span></span>

<style>
  .tile { display: block; width: var(--tw, 40px); flex: none; line-height: 0; border-radius: calc(var(--tw, 40px) * 0.12); box-shadow: 0 calc(var(--tw, 40px) * 0.06) 0 #6f6650, 0 2px 4px rgb(0 0 0 / 0.35); }
  .face { display: block; }
  .tile :global(svg) { width: 100%; height: auto; display: block; }
  .tile.lit { outline: 2px solid var(--brass-hi); outline-offset: 1px; }
  .tile.sideways { width: calc(var(--tw, 40px) * 1.3333); height: var(--tw, 40px); align-self: flex-end; }
  .tile.sideways .face { width: var(--tw, 40px); transform-origin: 0 0; transform: translateX(calc(var(--tw, 40px) * 1.3333)) rotate(90deg); }
</style>
