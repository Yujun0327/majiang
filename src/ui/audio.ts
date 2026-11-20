/** Synthesized table sounds: tile clacks, a call, the win. Zero audio binaries. */
import { APP } from '../app/persist'
import type { SfxEvent } from '../app/session.svelte'

let ctx: AudioContext | null = null
let muted = localStorage.getItem(`${APP}:muted`) === '1'

function ac(): AudioContext {
  ctx ??= new AudioContext()
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

function tone(freq: number, t = 0, dur = 0.14, vol = 0.16, type: OscillatorType = 'triangle'): void {
  const a = ac()
  const osc = a.createOscillator()
  const gain = a.createGain()
  const start = a.currentTime + t
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
  osc.connect(gain).connect(a.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

/** A hard tile on wood: a short filtered noise burst with a woody knock under it. */
function clack(t = 0, vol = 0.5): void {
  const a = ac()
  const len = Math.floor(a.sampleRate * 0.04)
  const buffer = a.createBuffer(1, len, a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  const src = a.createBufferSource()
  src.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2600
  const gain = a.createGain()
  gain.gain.value = vol
  src.connect(filter).connect(gain).connect(a.destination)
  src.start(a.currentTime + t)
  tone(190, t, 0.05, 0.12, 'sine')
}

export function play(sfx: SfxEvent): void {
  if (muted) return
  try {
    switch (sfx) {
      case 'tile':
        clack()
        break
      case 'claim':
        clack()
        clack(0.09, 0.4)
        tone(660, 0.02, 0.18)
        break
      case 'gang':
        clack()
        clack(0.08, 0.45)
        clack(0.16, 0.4)
        tone(520, 0.02, 0.22)
        break
      case 'deal':
        clack(0, 0.28)
        clack(0.05, 0.22)
        break
      case 'shuffle':
        // the wall being pushed together: a run of soft clacks
        for (let i = 0; i < 14; i++) clack(i * 0.055 + Math.random() * 0.02, 0.16 + Math.random() * 0.12)
        break
      case 'dice':
        // two dice rattling, then coming to rest
        for (let i = 0; i < 9; i++) tone(900 + Math.random() * 700, i * 0.09 + Math.random() * 0.03, 0.03, 0.07, 'square')
        clack(0.95, 0.35)
        clack(1.05, 0.3)
        break
      case 'win':
        ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 0.18))
        break
      case 'lose':
        tone(330, 0, 0.3, 0.14)
        tone(247, 0.16, 0.4, 0.14)
        break
      case 'draw':
        tone(392, 0, 0.35, 0.12, 'sine')
        break
    }
  } catch {
    /* no audio */
  }
}
