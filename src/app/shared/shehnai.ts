/**
 * A soft shehnai-like melody with a tanpura drone, synthesised with the Web Audio API, so there is
 * no audio file to download and no recording rights to worry about. Off until the guest taps it.
 */

// Raga Yaman flavour (Sa Re Ga Ma# Pa Dha Ni) around C4, as semitone offsets with beat lengths.
const PHRASE: [number, number][] = [
  [11, 1], [14, 1], [16, 2], [18, 1], [16, 1], [14, 2], [11, 1], [14, 1], [12, 2], [11, 2],
  [7, 1], [9, 1], [11, 2], [14, 1], [12, 1], [11, 1], [9, 1], [7, 4],
];
const BEAT = 0.42;
const BASE = 261.63; // C4

const freq = (semitones: number) => BASE * 2 ** (semitones / 12);

export class Shehnai {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private master: GainNode | null = null;

  get playing(): boolean {
    return !!this.ctx;
  }

  start(): void {
    if (this.ctx) return;
    const Ctx = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 1.5);
    this.master.connect(ctx.destination);
    this.drone(ctx);
    this.loop();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && this.master) {
      this.master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      setTimeout(() => void ctx.close(), 500);
    }
  }

  private drone(ctx: AudioContext): void {
    for (const semis of [-12, -5, 0]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq(semis);
      gain.gain.value = 0.12;
      osc.connect(gain).connect(this.master!);
      osc.start();
    }
  }

  private loop(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    let t = ctx.currentTime + 0.1;
    for (const [note, beats] of PHRASE) {
      this.note(ctx, freq(note), t, beats * BEAT);
      t += beats * BEAT;
    }
    const length = PHRASE.reduce((s, [, b]) => s + b * BEAT, 0);
    this.timer = setTimeout(() => this.loop(), (length + 1.2) * 1000);
  }

  /** A reedy tone: sawtooth through a band-pass filter, with slow vibrato and a soft attack. */
  private note(ctx: AudioContext, f: number, at: number, length: number): void {
    const osc = ctx.createOscillator();
    const vibrato = ctx.createOscillator();
    const depth = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f * 0.985, at);
    osc.frequency.linearRampToValueAtTime(f, at + 0.08); // a little meend into the note
    vibrato.frequency.value = 5.2;
    depth.gain.value = f * 0.012;
    vibrato.connect(depth).connect(osc.frequency);
    filter.type = 'bandpass';
    filter.frequency.value = f * 2.4;
    filter.Q.value = 1.4;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.5, at + 0.07);
    env.gain.setValueAtTime(0.5, at + length * 0.75);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(filter).connect(env).connect(this.master!);
    osc.start(at);
    vibrato.start(at);
    osc.stop(at + length + 0.05);
    vibrato.stop(at + length + 0.05);
  }
}
