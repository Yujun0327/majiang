<script lang="ts">
  /**
   * The table's carpet, drawn once as a vector under everything else: a
   * rosewood rim with brass corners, a crimson border carrying a gold fret
   * (回纹), a jade field woven with a faint coin lattice, a lotus medallion
   * under the centre plate, and a rosette in each of the four open diagonals.
   * Design space 1000 × 1000; purely decorative.
   */
  const petals = (n: number) => Array.from({ length: n }, (_, i) => (360 / n) * i)
  const DIAGONALS = [
    [255, 255],
    [745, 255],
    [255, 745],
    [745, 745],
  ]
  const CORNERS = [0, 90, 180, 270]
</script>

<svg class="art" viewBox="0 0 1000 1000" aria-hidden="true">
  <defs>
    <radialGradient id="ba-field" cx="50%" cy="46%" r="62%">
      <stop offset="0" stop-color="#22705b" />
      <stop offset="0.55" stop-color="#155543" />
      <stop offset="1" stop-color="#0c3a2e" />
    </radialGradient>
    <linearGradient id="ba-wood" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6b3b26" />
      <stop offset="0.45" stop-color="#3f1f13" />
      <stop offset="1" stop-color="#5a2f1e" />
    </linearGradient>
    <linearGradient id="ba-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3dc92" />
      <stop offset="0.5" stop-color="#c79a3a" />
      <stop offset="1" stop-color="#8a6420" />
    </linearGradient>
    <linearGradient id="ba-red" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8a2620" />
      <stop offset="1" stop-color="#5f1714" />
    </linearGradient>

    <!-- coin lattice: overlapping circles, the classic 钱纹 ground -->
    <pattern id="ba-coin" width="44" height="44" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="#e9cf85" stroke-opacity="0.085" stroke-width="1.2">
        <circle cx="0" cy="0" r="22" />
        <circle cx="44" cy="0" r="22" />
        <circle cx="0" cy="44" r="22" />
        <circle cx="44" cy="44" r="22" />
        <circle cx="22" cy="22" r="22" />
      </g>
      <g fill="#e9cf85" fill-opacity="0.1">
        <rect x="19.5" y="19.5" width="5" height="5" transform="rotate(45 22 22)" />
        <rect x="-2.5" y="-2.5" width="5" height="5" transform="rotate(45 0 0)" />
        <rect x="41.5" y="41.5" width="5" height="5" transform="rotate(45 44 44)" />
      </g>
    </pattern>

    <!-- the fret: one square hook per repeat -->
    <pattern id="ba-fret" width="26" height="22" patternUnits="userSpaceOnUse">
      <path d="M2 20 V3 H22 V15 H9 V9 H16" fill="none" stroke="url(#ba-gold)" stroke-width="2" stroke-linecap="square" />
    </pattern>

    <g id="ba-rosette">
      <circle r="60" fill="none" stroke="url(#ba-gold)" stroke-width="1.6" opacity="0.55" />
      <circle r="52" fill="none" stroke="url(#ba-gold)" stroke-width="0.9" stroke-dasharray="2 5" opacity="0.6" />
      {#each petals(8) as a (a)}
        <path d="M0 -8 C 13 -22, 13 -40, 0 -48 C -13 -40, -13 -22, 0 -8 Z" transform="rotate({a})" fill="#e9cf85" fill-opacity="0.07" stroke="url(#ba-gold)" stroke-width="1.3" opacity="0.6" />
      {/each}
      {#each petals(8) as a (a)}
        <path d="M0 -6 C 6 -12, 6 -20, 0 -25 C -6 -20, -6 -12, 0 -6 Z" transform="rotate({a + 22.5})" fill="url(#ba-gold)" opacity="0.35" />
      {/each}
      <circle r="6" fill="url(#ba-gold)" opacity="0.6" />
    </g>

    <!-- a brass corner fitting for the rim -->
    <g id="ba-corner">
      <path d="M0 0 H92 Q86 14 70 16 H34 Q18 18 16 34 V70 Q14 86 0 92 Z" fill="url(#ba-gold)" />
      <path d="M8 8 H74 Q66 12 58 12 H30 Q14 14 12 30 V58 Q12 66 8 74 Z" fill="none" stroke="#5c3d0e" stroke-width="1.2" opacity="0.7" />
      <circle cx="22" cy="22" r="5.5" fill="#7d5c18" />
      <circle cx="22" cy="22" r="2.4" fill="#f3dc92" />
      <path d="M40 9 q8 7 0 14 M9 40 q7 8 14 0" fill="none" stroke="#5c3d0e" stroke-width="1.2" opacity="0.6" />
    </g>
  </defs>

  <!-- rim -->
  <rect x="0" y="0" width="1000" height="1000" rx="34" fill="url(#ba-wood)" />
  <rect x="5" y="5" width="990" height="990" rx="30" fill="none" stroke="#1d0d07" stroke-width="2" opacity="0.7" />
  <rect x="11" y="11" width="978" height="978" rx="25" fill="none" stroke="url(#ba-gold)" stroke-width="1.4" opacity="0.75" />

  <!-- carpet: crimson border, then the jade field -->
  <rect x="17" y="17" width="966" height="966" rx="20" fill="url(#ba-red)" />
  <rect x="58" y="58" width="884" height="884" rx="8" fill="url(#ba-field)" />
  <rect x="58" y="58" width="884" height="884" rx="8" fill="url(#ba-coin)" />

  <!-- the fret runs along all four sides of the border -->
  {#each CORNERS as a (a)}
    <g transform="rotate({a} 500 500)">
      <rect x="71" y="27" width="858" height="22" fill="url(#ba-fret)" />
      <!-- a boxed knot where two sides meet -->
      <g transform="translate(38 38)">
        <rect x="-12" y="-12" width="24" height="24" fill="none" stroke="url(#ba-gold)" stroke-width="2" />
        <rect x="-6" y="-6" width="12" height="12" transform="rotate(45)" fill="url(#ba-gold)" opacity="0.85" />
      </g>
    </g>
  {/each}
  <rect x="21" y="21" width="958" height="958" rx="17" fill="none" stroke="url(#ba-gold)" stroke-width="1.6" opacity="0.9" />
  <rect x="55" y="55" width="890" height="890" rx="9" fill="none" stroke="url(#ba-gold)" stroke-width="2.4" />
  <rect x="64" y="64" width="872" height="872" rx="5" fill="none" stroke="#e9cf85" stroke-width="0.9" opacity="0.45" />

  <!-- cloud scrolls curling in from each corner of the field -->
  {#each CORNERS as a (a)}
    <g transform="rotate({a} 500 500)" fill="none" stroke="url(#ba-gold)" stroke-linecap="round" opacity="0.5">
      <path d="M76 150 C 76 104, 104 76, 150 76" stroke-width="2" />
      <path d="M84 196 C 84 128, 128 84, 196 84" stroke-width="1" stroke-dasharray="1 6" />
      <path d="M98 126 c 16 -4, 26 6, 20 18 c -5 10, -20 8, -19 -3 c 1 -7, 9 -8, 11 -3" stroke-width="1.8" />
      <path d="M126 98 c -4 16, 6 26, 18 20 c 10 -5, 8 -20, -3 -19 c -7 1, -8 9, -3 11" stroke-width="1.8" />
    </g>
  {/each}

  <!-- lotus medallion under the centre plate -->
  <g transform="translate(500 500)">
    <circle r="238" fill="#0b3329" opacity="0.28" />
    <circle r="238" fill="none" stroke="url(#ba-gold)" stroke-width="2.2" opacity="0.7" />
    <circle r="228" fill="none" stroke="#e9cf85" stroke-width="0.9" opacity="0.4" />
    {#each petals(24) as a (a)}
      <path d="M0 -186 C 18 -200, 18 -216, 0 -226 C -18 -216, -18 -200, 0 -186 Z" transform="rotate({a})" fill="#e9cf85" fill-opacity="0.06" stroke="url(#ba-gold)" stroke-width="1.2" opacity="0.6" />
    {/each}
    <circle r="182" fill="none" stroke="url(#ba-gold)" stroke-width="1.4" stroke-dasharray="10 5 2 5" opacity="0.55" />
    <circle r="174" fill="none" stroke="#e9cf85" stroke-width="0.8" opacity="0.3" />
  </g>

  {#each DIAGONALS as [x, y] (`${x}-${y}`)}
    <use href="#ba-rosette" x={x} y={y} />
  {/each}

  <!-- brass fittings on the rim's corners -->
  {#each CORNERS as a (a)}
    <use href="#ba-corner" transform="rotate({a} 500 500)" opacity="0.92" />
  {/each}

  <!-- the lamp: a soft pool of light and a darker edge -->
  <radialGradient id="ba-lamp" cx="50%" cy="44%" r="60%">
    <stop offset="0" stop-color="#fff2c8" stop-opacity="0.13" />
    <stop offset="0.6" stop-color="#fff2c8" stop-opacity="0" />
    <stop offset="1" stop-color="#000" stop-opacity="0.32" />
  </radialGradient>
  <rect x="17" y="17" width="966" height="966" rx="20" fill="url(#ba-lamp)" />
</svg>

<style>
  .art { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 3.4cqw; filter: drop-shadow(0 10px 22px rgb(0 0 0 / 0.6)); }
</style>
