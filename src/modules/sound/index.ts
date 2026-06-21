/**
 * sound — keystroke clicks. Plays a real Apple Magic Keyboard key-press sample
 * (bundled, no network) on every character typed, and a softer/lower variant per
 * character removed — so the clear/backspace animation produces a satisfying
 * per-key cascade. Falls back to a synthesized click if the sample can't decode.
 *
 * Uses Web Audio (not <audio>) so rapid keystrokes overlap cleanly and latency is
 * low. Gated by the browser autoplay policy: the AudioContext stays suspended
 * until the first user gesture, so nothing plays on page load.
 */
import type { OpenKeysModule } from '../../core/types';
import keyPressUrl from './key-press.mp3';

export const sound: OpenKeysModule = ({ engine, signal }) => {
  // Note: we always wire up (when Web Audio exists) rather than gating at init, so
  // the settings toggle can mute/unmute live in both directions. Actual playback is
  // gated per-hit on the live `features.sound` flag below.
  const AC: typeof AudioContext | undefined =
    window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return () => {}; // no Web Audio → silently no-op

  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);

  let sample: AudioBuffer | null = null;
  let aborted = false;

  // Load + decode the bundled sample once.
  fetch(keyPressUrl, { signal })
    .then((r) => r.arrayBuffer())
    .then((buf) => ctx.decodeAudioData(buf))
    .then((decoded) => {
      if (!aborted) sample = decoded;
    })
    .catch(() => {
      /* fall back to the synth click below */
    });

  const resume = () => {
    if (ctx.state === 'suspended') void ctx.resume();
  };
  // The first gesture unlocks audio; the keystroke that follows is then audible.
  window.addEventListener('pointerdown', resume, { signal });
  window.addEventListener('keydown', resume, { signal });

  /** Play the recorded sample with small natural variation. */
  const playSample = (rate: number, gain: number) => {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = sample!;
    src.playbackRate.value = rate * (0.97 + Math.random() * 0.06); // subtle per-hit variation
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(master);
    src.start(t);
  };

  /** Synthesized fallback: a short tonal "thock" with a falling pitch. */
  const synth = (freq: number, dur: number, peak: number) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.55), t + dur);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(og).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  const playType = () => {
    if (!engine.config.features.sound) return; // live mute toggle
    if (ctx.state !== 'running') return;
    if (sample) playSample(1.0, 0.9);
    else synth(440 + (Math.random() * 50 - 25), 0.05, 0.2);
  };
  const playClear = () => {
    if (!engine.config.features.sound) return; // live mute toggle
    if (ctx.state !== 'running') return;
    if (sample) playSample(0.82, 0.6); // lower + softer reads as "delete"
    else synth(300, 0.05, 0.16);
  };

  let prevLen = engine.currentText.length;
  const off = engine.on('textchange', ({ length }) => {
    if (length > prevLen) playType();
    else if (length < prevLen) playClear();
    prevLen = length;
  });

  return () => {
    aborted = true;
    off();
    void ctx.close();
  };
};
