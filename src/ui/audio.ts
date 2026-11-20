/**
 * The sound of the table, synthesized — no audio files.
 *
 * Everything runs through one small mixing desk: a dry bus and a reverb send
 * (a generated room impulse) into a gentle compressor, so sounds sit in the
 * same space instead of clicking in and out of silence.
 *
 * - Tiles are resonant: a very short noise burst rings three narrow band-pass
 *   "modes" (the hard click of melamine) over a low knock (the table), with a
 *   small second bounce. Pitch, level and timing are jittered on every hit so
 *   no two are alike.
 * - Calls use the vocabulary of a Chinese percussion desk: a woodblock tok,
 *   struck bells in a pentatonic scale, a drum for a kong, and for a win a
 *   deep gong under a plucked run and a sustained chord.
 */
import { APP } from '../app/persist'
import type { SfxEvent } from '../app/session.svelte'
import { CALL_FLIGHT_MS, DRAW_DELAY_MS, FLIGHT_MS, ROLL_MS } from '../app/timing'

let ctx: AudioContext | null = null
let dry: GainNode
let wet: GainNode
let noiseBuf: AudioBuffer
let muted = localStorage.getItem(`${APP}:muted`) === '1'

const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo)

/** A decaying burst of stereo noise: the impulse response of a mid-sized, soft-walled room. */
function roomImpulse(a: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(a.sampleRate * seconds)
  const buf = a.createBuffer(2, len, a.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      const t = i / len
      // a short pre-delay, then an exponential tail that darkens as it fades
      d[i] = i < a.sampleRate * 0.012 ? 0 : (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (0.6 + 0.4 * Math.exp(-t * 6))
    }
  }
  return buf
}

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 18
    comp.ratio.value = 3.5
    comp.attack.value = 0.004
    comp.release.value = 0.22
    const master = ctx.createGain()
    master.gain.value = 0.9
    comp.connect(master).connect(ctx.destination)

    dry = ctx.createGain()
    dry.connect(comp)

    wet = ctx.createGain()
    const verb = ctx.createConvolver()
    verb.buffer = roomImpulse(ctx, 2.6)
    const tone = ctx.createBiquadFilter() // keep the tail warm, not hissy
    tone.type = 'lowpass'
    tone.frequency.value = 5200
    const level = ctx.createGain()
    level.gain.value = 0.55
    wet.connect(verb).connect(tone).connect(level).connect(comp)

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Call from a user gesture so the browser lets sound start. */
export function unlock(): void {
  try {
    ac()
  } catch {
    /* no audio */
  }
}

export function setMuted(m: boolean): void {
  muted = m
  localStorage.setItem(`${APP}:muted`, m ? '1' : '0')
}

export const isMuted = (): boolean => muted

/** An output for one voice: `level` to the dry bus, `send` of it on to the reverb. */
function out(level: number, send: number): GainNode {
  const a = ac()
  const g = a.createGain()
  g.gain.value = level
  g.connect(dry)
  if (send > 0) {
    const s = a.createGain()
    s.gain.value = send
    g.connect(s).connect(wet)
  }
  return g
}

function noise(at: number, seconds: number): AudioBufferSourceNode {
  const a = ac()
  const src = a.createBufferSource()
  src.buffer = noiseBuf
  src.start(at, rnd(0, 1.5), seconds + 0.05)
  return src
}

/* ------------------------------------------------------------------ */
/* tiles                                                               */
/* ------------------------------------------------------------------ */

interface Hit {
  vol?: number
  /** Relative pitch: smaller = a heavier, lower hit. */
  pitch?: number
  /** The low knock of the table under the click. */
  body?: number
  send?: number
  bounce?: boolean
}

/** One tile striking a surface. */
function clack(t = 0, { vol = 0.5, pitch = 1, body = 0.6, send = 0.1, bounce = true }: Hit = {}): void {
  const a = ac()
  const at = a.currentTime + t
  const p = pitch * rnd(0.93, 1.07)
  const bus = out(vol * rnd(0.85, 1), send)

  // the click: a 30 ms burst ringing three narrow modes
  const src = noise(at, 0.06)
  const env = a.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(1, at + 0.0012)
  env.gain.exponentialRampToValueAtTime(0.0008, at + 0.045)
  const modes: [number, number, number][] = [
    [1850, 9, 1],
    [3050, 13, 0.7],
    [4800, 10, 0.38],
  ]
  for (const [f, q, g] of modes) {
    const bp = a.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = f * p * rnd(0.97, 1.03)
    bp.Q.value = q
    const mg = a.createGain()
    mg.gain.value = g * 2.4
    src.connect(bp).connect(mg).connect(env)
  }
  // the very first contact: 3 ms of air above 6 kHz
  const tick = a.createBiquadFilter()
  tick.type = 'highpass'
  tick.frequency.value = 6000
  const tg = a.createGain()
  tg.gain.setValueAtTime(0.5, at)
  tg.gain.exponentialRampToValueAtTime(0.0008, at + 0.006)
  src.connect(tick).connect(tg).connect(bus)
  env.connect(bus)

  // the knock: the table answering, a sine dropping a fifth in 60 ms
  if (body > 0) {
    const osc = a.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(175 * p, at)
    osc.frequency.exponentialRampToValueAtTime(92 * p, at + 0.06)
    const bg = a.createGain()
    bg.gain.setValueAtTime(0.0001, at)
    bg.gain.exponentialRampToValueAtTime(body, at + 0.004)
    bg.gain.exponentialRampToValueAtTime(0.0008, at + 0.11)
    osc.connect(bg).connect(bus)
    osc.start(at)
    osc.stop(at + 0.14)
  }
  // the tile rocks once before lying flat
  if (bounce && Math.random() < 0.8) clack(t + rnd(0.045, 0.075), { vol: vol * rnd(0.22, 0.34), pitch: pitch * 1.09, body: body * 0.25, send, bounce: false })
}

/** A tile sliding or moving through the air: a soft band of noise that swells and fades. */
function swish(t = 0, seconds = 0.22, vol = 0.05, from = 700, to = 2200): void {
  const a = ac()
  const at = a.currentTime + t
  const src = noise(at, seconds)
  const bp = a.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.1
  bp.frequency.setValueAtTime(from, at)
  bp.frequency.exponentialRampToValueAtTime(to, at + seconds)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(1, at + seconds * 0.4)
  g.gain.exponentialRampToValueAtTime(0.0008, at + seconds)
  src.connect(bp).connect(g).connect(out(vol, 0.05))
}

/** A set laid down: tiles landing almost together, left to right. */
function setDown(t: number, count: number): void {
  for (let i = 0; i < count; i++) clack(t + i * rnd(0.035, 0.055), { vol: 0.5, pitch: rnd(0.9, 1), body: 0.7 })
}

/* ------------------------------------------------------------------ */
/* pitched voices                                                      */
/* ------------------------------------------------------------------ */

/** Major pentatonic on C: the scale of every chime here. */
const N = { G3: 196, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98 }

/** A small struck bell: a few inharmonic partials, the high ones dying first. */
function bell(freq: number, t = 0, vol = 0.14, seconds = 1.6, send = 0.5): void {
  const a = ac()
  const at = a.currentTime + t
  const bus = out(vol, send)
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [2.0, 0.42, 0.7],
    [2.76, 0.3, 0.45],
    [4.07, 0.16, 0.3],
    [5.43, 0.08, 0.2],
  ]
  for (const [ratio, gain, life] of partials) {
    const osc = a.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq * ratio * rnd(0.999, 1.001)
    const g = a.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(gain, at + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0006, at + seconds * life)
    osc.connect(g).connect(bus)
    osc.start(at)
    osc.stop(at + seconds * life + 0.05)
  }
}

/** A plucked silk string: a bright attack whose brightness and level fall away together. */
function pluck(freq: number, t = 0, vol = 0.12, seconds = 1.4, send = 0.4): void {
  const a = ac()
  const at = a.currentTime + t
  const bus = out(vol, send)
  const lp = a.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 2
  lp.frequency.setValueAtTime(Math.min(freq * 9, 14000), at)
  lp.frequency.exponentialRampToValueAtTime(freq * 1.6, at + seconds * 0.6)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(1, at + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0006, at + seconds)
  for (const detune of [-4, 5]) {
    const osc = a.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq * 1.012, at) // the string is sharp for an instant as it is pulled
    osc.frequency.exponentialRampToValueAtTime(freq, at + 0.05)
    osc.detune.value = detune
    osc.connect(lp)
    osc.start(at)
    osc.stop(at + seconds + 0.05)
  }
  lp.connect(g).connect(bus)
}

/** A woodblock: a dry, round "tok". */
function woodblock(t = 0, vol = 0.3, freq = 940): void {
  const a = ac()
  const at = a.currentTime + t
  const bus = out(vol, 0.22)
  for (const [ratio, gain, life] of [[1, 1, 0.09], [2.42, 0.35, 0.05]] as [number, number, number][]) {
    const osc = a.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq * ratio * 1.04, at)
    osc.frequency.exponentialRampToValueAtTime(freq * ratio, at + 0.012)
    const g = a.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(gain, at + 0.0015)
    g.gain.exponentialRampToValueAtTime(0.0006, at + life)
    osc.connect(g).connect(bus)
    osc.start(at)
    osc.stop(at + life + 0.03)
  }
  const src = noise(at, 0.02)
  const bp = a.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq * 2
  bp.Q.value = 3
  const ng = a.createGain()
  ng.gain.setValueAtTime(0.5, at)
  ng.gain.exponentialRampToValueAtTime(0.0006, at + 0.014)
  src.connect(bp).connect(ng).connect(bus)
}

/** A low hand drum: the skin's thump and a short breath of noise. */
function drum(t = 0, vol = 0.5, freq = 96): void {
  const a = ac()
  const at = a.currentTime + t
  const bus = out(vol, 0.3)
  const osc = a.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq * 1.9, at)
  osc.frequency.exponentialRampToValueAtTime(freq, at + 0.09)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(1, at + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0006, at + 0.55)
  osc.connect(g).connect(bus)
  osc.start(at)
  osc.stop(at + 0.6)
  const src = noise(at, 0.09)
  const lp = a.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  const ng = a.createGain()
  ng.gain.setValueAtTime(0.5, at)
  ng.gain.exponentialRampToValueAtTime(0.0006, at + 0.08)
  src.connect(lp).connect(ng).connect(bus)
}

/** A large gong: slow-blooming inharmonic partials over a wash of metal, ringing for seconds. */
function gong(t = 0, vol = 0.34, base = 98, seconds = 4.2): void {
  const a = ac()
  const at = a.currentTime + t
  const bus = out(vol, 0.6)
  const ratios = [1, 1.49, 2.02, 2.47, 3.13, 4.08, 5.21, 6.6]
  ratios.forEach((ratio, i) => {
    const osc = a.createOscillator()
    osc.type = 'sine'
    const f = base * ratio * rnd(0.992, 1.008)
    osc.frequency.setValueAtTime(f * 0.985, at)
    osc.frequency.linearRampToValueAtTime(f, at + 0.5) // the pitch rises a hair as the metal settles
    const g = a.createGain()
    const peak = 1 / (1 + i * 0.75)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + 0.012 + i * 0.03) // higher partials bloom later
    g.gain.exponentialRampToValueAtTime(0.0005, at + seconds / (1 + i * 0.28))
    // a slow beat between close partials: the shimmer of a real gong
    const trem = a.createOscillator()
    trem.frequency.value = rnd(2.5, 6)
    const depth = a.createGain()
    depth.gain.value = peak * 0.18
    trem.connect(depth).connect(g.gain)
    osc.connect(g).connect(bus)
    osc.start(at)
    trem.start(at)
    osc.stop(at + seconds)
    trem.stop(at + seconds)
  })
  // the strike itself: a mallet's soft thud and a bright wash that fades in a second
  const src = noise(at, 1.4)
  const bp = a.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(900, at)
  bp.frequency.exponentialRampToValueAtTime(3200, at + 0.4)
  bp.Q.value = 0.7
  const ng = a.createGain()
  ng.gain.setValueAtTime(0.0001, at)
  ng.gain.exponentialRampToValueAtTime(0.5, at + 0.05)
  ng.gain.exponentialRampToValueAtTime(0.0005, at + 1.3)
  src.connect(bp).connect(ng).connect(bus)
  drum(t, vol * 0.9, base * 0.75)
}

/* ------------------------------------------------------------------ */
/* the cues                                                            */
/* ------------------------------------------------------------------ */

const LAND = FLIGHT_MS / 1000 - 0.06
const SET_LAND = CALL_FLIGHT_MS / 1000 - 0.08

export function play(sfx: SfxEvent): void {
  if (muted) return
  try {
    switch (sfx) {
      case 'tile':
        // the throw: air, then the tile hits the table as it lands
        swish(0.05, LAND - 0.1, 0.035, 500, 1700)
        clack(LAND, { vol: 0.62, body: 0.75, send: 0.14 })
        break
      case 'pick': {
        // a tile lifted off the wall, then set into the hand
        const start = DRAW_DELAY_MS / 1000
        clack(start, { vol: 0.16, pitch: 1.18, body: 0.1, bounce: false })
        swish(start + 0.03, 0.3, 0.025, 900, 2600)
        clack(start + LAND, { vol: 0.24, pitch: 1.1, body: 0.25, bounce: false })
        break
      }
      case 'deal':
        // a batch pushed out of the wall and stood up in a hand
        swish(0, 0.35, 0.03, 600, 1800)
        clack(0.02, { vol: 0.2, pitch: 1.05, body: 0.3 })
        clack(0.02 + rnd(0.05, 0.09), { vol: 0.16, pitch: 0.98, body: 0.2 })
        break
      case 'shuffle': {
        // building the wall: a long clatter of tiles being pushed together, thinning out at the end
        const a = ac()
        const length = 2.7
        for (let i = 0; i < 70; i++) {
          const t = Math.pow(i / 70, 0.85) * length + rnd(0, 0.03)
          clack(t, { vol: rnd(0.14, 0.42) * (1 - (i / 70) * 0.45), pitch: rnd(0.85, 1.2), body: rnd(0.1, 0.5), bounce: false, send: 0.2 })
        }
        // the slide of many tiles on felt underneath
        const at = a.currentTime
        const src = noise(at, length)
        const bp = a.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1300
        bp.Q.value = 0.6
        const g = a.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(1, at + 0.5)
        g.gain.exponentialRampToValueAtTime(0.0006, at + length)
        src.connect(bp).connect(g).connect(out(0.06, 0.2))
        break
      }
      case 'dice': {
        // two dice knocking against each other and the table, slowing to a stop
        const roll = ROLL_MS / 1000
        let t = 0
        let gap = 0.07
        while (t < roll - 0.25) {
          clack(t, { vol: rnd(0.1, 0.24), pitch: rnd(1.5, 2.1), body: 0.08, bounce: false, send: 0.16 })
          t += gap * rnd(0.7, 1.3)
          gap *= 1.045
        }
        clack(roll - 0.12, { vol: 0.34, pitch: 1.6, body: 0.3, bounce: false })
        clack(roll, { vol: 0.4, pitch: 1.45, body: 0.4 })
        bell(N.E6, roll + 0.12, 0.05, 0.9)
        break
      }
      case 'chi':
        // a light call: one tok, two rising chimes
        woodblock(0, 0.26, 980)
        bell(N.E5, 0.14, 0.11, 1.3)
        bell(N.G5, 0.3, 0.12, 1.6)
        setDown(SET_LAND, 3)
        break
      case 'peng':
        // a firm call: a double tok and an open fifth with its octave
        woodblock(0, 0.3, 860)
        woodblock(0.13, 0.34, 860)
        bell(N.A4, 0.26, 0.13, 1.9)
        bell(N.E5, 0.26, 0.1, 1.9)
        bell(N.A5, 0.44, 0.09, 2.1)
        setDown(SET_LAND, 3)
        break
      case 'gang':
        // a heavy call: the drum, a tok, and a run up the scale
        drum(0, 0.5, 92)
        woodblock(0.1, 0.3, 760)
        ;[N.D5, N.G5, N.A5, N.D6].forEach((f, i) => bell(f, 0.26 + i * 0.1, 0.1, 1.8 + i * 0.2))
        pluck(N.D4, 0.26, 0.1, 1.6)
        setDown(SET_LAND, 4)
        break
      case 'win': {
        // the gong, a plucked run climbing two octaves, then a held chord and a last glint
        gong(0, 0.34, 98, 4.6)
        const run = [N.C4, N.D4, N.E4, N.G4, N.A4, N.C5, N.D5, N.E5, N.G5, N.A5, N.C6, N.D6, N.E6, N.G6]
        run.forEach((f, i) => pluck(f, 0.32 + i * 0.062, 0.085 + i * 0.002, 1.5))
        const top = 0.32 + run.length * 0.062
        ;[N.C5, N.E5, N.G5, N.C6].forEach((f, i) => bell(f, top + 0.1 + i * 0.035, 0.11, 3.4, 0.7))
        pluck(N.C4, top + 0.1, 0.12, 2.6)
        pluck(N.G3, top + 0.1, 0.1, 2.8)
        ;[N.E6, N.G6, N.C6, N.G6].forEach((f, i) => bell(f, top + 0.75 + i * 0.16, 0.05, 1.6, 0.8))
        break
      }
      case 'lose':
        // someone else's win: the gong heard from across the room, and two falling notes
        gong(0, 0.2, 110, 3.2)
        pluck(N.A4, 0.4, 0.09, 1.8)
        pluck(N.E4, 0.72, 0.09, 2.2)
        break
      case 'draw':
        // the wall ran out: two quiet bells and the room
        bell(N.G4, 0, 0.1, 2.6, 0.7)
        bell(N.D4, 0.28, 0.1, 3, 0.7)
        swish(0, 0.9, 0.02, 400, 900)
        break
    }
  } catch (err) {
    console.warn('[audio]', sfx, err) // never let a sound break the game
  }
}
