import { useDocumentVisibility } from "@mantine/hooks";
import { Array as Arr, Effect, Option } from "effect";
import { useEffect } from "react";
import { useSkyStore } from "@/components/island/sky";
import { useSoundStore } from "@/components/island/sound";
import {
  ambienceOf,
  barOf,
  chance,
  cueOf,
  frequencyOf,
  STEPS_PER_BAR,
  stepSeconds,
  type Voice,
} from "@/lib/island/music";

/** How far ahead the scheduler queues notes, and how often it wakes, in seconds and milliseconds. */
const LOOKAHEAD = 0.15;
const WAKE_GAP = 40;
/** The loudness of everything together, of the music, and of the cues. */
const MASTER_LEVEL = 0.5;
const CUE_LEVEL = 0.35;

/**
 * Runs one of the audio context's own promises (resume, suspend, close) to its
 * end. A context the browser already closed refuses them, which leaves nothing
 * to do.
 */
function settle(run: () => Promise<void>) {
  Effect.runFork(Effect.tryPromise(run).pipe(Effect.ignore));
}

/**
 * Plays one note on an instrument: a plucked triangle, a soft pad of two
 * slightly detuned sines, a bell with its inharmonic partial, or a high chime.
 * Every note shapes its loudness with an envelope, so nothing clicks.
 */
function playNote(
  context: AudioContext,
  out: AudioNode,
  voice: Voice,
  midi: number,
  at: number,
  length: number,
  level: number
) {
  const frequency = frequencyOf(midi);
  const envelope = context.createGain();
  envelope.connect(out);
  const shape = {
    bell: { attack: 0.005, partials: [1, 2.76], release: 1.6, wave: "sine" },
    chime: { attack: 0.005, partials: [2, 4], release: 1.2, wave: "sine" },
    pad: { attack: 0.25, partials: [1, 1.003], release: 0.9, wave: "sine" },
    pluck: { attack: 0.005, partials: [1], release: 0.35, wave: "triangle" },
  } as const;
  const { attack, partials, release, wave } = shape[voice];
  const end = at + length + release;
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(level, at + attack);
  envelope.gain.setTargetAtTime(
    0.0001,
    at + Math.max(attack, length),
    release / 4
  );
  Arr.forEach(partials, (partial, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency * partial, at);
    const weight = context.createGain();
    weight.gain.value = index === 0 ? 1 : 0.3;
    oscillator.connect(weight).connect(envelope);
    oscillator.start(at);
    oscillator.stop(end);
  });
}

/** Two seconds of white noise, looped as the source of rain and wind. */
function noiseOf(context: AudioContext) {
  const buffer = context.createBuffer(
    1,
    context.sampleRate * 2,
    context.sampleRate
  );
  const samples = buffer.getChannelData(0);
  Arr.forEach(Arr.range(0, samples.length - 1), (index) => {
    samples[index] = chance(index, 0, 7) * 2 - 1;
  });
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

/** One filtered noise layer whose loudness follows the weather. */
function layerOf(
  context: AudioContext,
  noise: AudioBufferSourceNode,
  out: AudioNode,
  type: BiquadFilterType,
  frequency: number
) {
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  const level = context.createGain();
  level.gain.value = 0;
  noise.connect(filter).connect(level).connect(out);
  return level;
}

/** A bird's chirp, a quick falling whistle, or a cricket's three short trills. */
function callOf(
  context: AudioContext,
  out: AudioNode,
  kind: "bird" | "cricket",
  at: number
) {
  const repeats = kind === "bird" ? [0, 0.12] : [0, 0.07, 0.14];
  Arr.forEach(repeats, (offset) => {
    const oscillator = context.createOscillator();
    const level = context.createGain();
    oscillator.type = kind === "bird" ? "sine" : "square";
    const high = kind === "bird" ? 3200 : 4400;
    oscillator.frequency.setValueAtTime(high, at + offset);
    oscillator.frequency.exponentialRampToValueAtTime(
      high * 0.7,
      at + offset + 0.06
    );
    level.gain.setValueAtTime(0.0001, at + offset);
    level.gain.exponentialRampToValueAtTime(
      kind === "bird" ? 0.05 : 0.012,
      at + offset + 0.01
    );
    level.gain.exponentialRampToValueAtTime(0.0001, at + offset + 0.06);
    oscillator.connect(level).connect(out);
    oscillator.start(at + offset);
    oscillator.stop(at + offset + 0.08);
  });
}

/**
 * The island's sound (ADR 0042, D19): generated music whose scale and tempo
 * follow the owner's hour and whose instrument follows the weather, rain and
 * wind from filtered noise, birds by day and crickets by night, and the cues
 * the owner's presses ask for. It plays on the audio context the first press
 * opened, follows the sky as it changes, suspends the context while sound is
 * off or the page is hidden, so it costs nothing then, and closes the context
 * when the frame goes.
 */
export default function IslandAudio() {
  const sound = useSoundStore();
  const sky = useSkyStore();
  const visibility = useDocumentVisibility();
  useEffect(() => {
    const opened = sound.getState().context;
    if (Option.isNone(opened)) {
      return;
    }
    const context = opened.value;
    const master = context.createGain();
    master.gain.value = sound.getState().muted ? 0 : MASTER_LEVEL;
    master.connect(context.destination);
    const music = context.createGain();
    music.gain.value = 0.6;
    music.connect(master);
    const noise = noiseOf(context);
    const rain = layerOf(context, noise, master, "bandpass", 2400);
    const wind = layerOf(context, noise, master, "lowpass", 420);
    noise.start();
    const follow = () => {
      const { phase, weather } = sky.getState();
      const ambience = ambienceOf(phase, weather);
      rain.gain.setTargetAtTime(ambience.rain, context.currentTime, 1);
      wind.gain.setTargetAtTime(ambience.wind, context.currentTime, 1.5);
    };
    follow();
    let step = 0;
    let next = context.currentTime + 0.1;
    const timer = window.setInterval(() => {
      const { phase, weather } = sky.getState();
      const ambience = ambienceOf(phase, weather);
      while (next < context.currentTime + LOOKAHEAD) {
        const bar = Math.floor(step / STEPS_PER_BAR);
        const within = step % STEPS_PER_BAR;
        const seconds = stepSeconds(phase);
        const at = next;
        Arr.forEach(
          Arr.filter(
            barOf(phase, weather, bar),
            (note) => note.step === within
          ),
          (note) =>
            playNote(
              context,
              music,
              note.voice,
              note.midi,
              at,
              note.length * seconds,
              note.velocity
            )
        );
        if (ambience.birds && chance(bar, within, 11) < 0.04) {
          callOf(context, master, "bird", at);
        }
        if (ambience.crickets && chance(bar, within, 13) < 0.12) {
          callOf(context, master, "cricket", at);
        }
        step += 1;
        next += seconds;
      }
    }, WAKE_GAP);
    const stopSky = sky.subscribe(follow);
    const stopSound = sound.subscribe((state, before) => {
      if (state.muted !== before.muted) {
        master.gain.value = state.muted ? 0 : MASTER_LEVEL;
        settle(() => (state.muted ? context.suspend() : context.resume()));
      }
      if (state.muted || Option.isNone(state.cue) || state.cue === before.cue) {
        return;
      }
      Arr.forEach(cueOf(state.cue.value.name), (note) =>
        playNote(
          context,
          master,
          note.voice,
          note.midi,
          context.currentTime + note.delay,
          note.length,
          CUE_LEVEL
        )
      );
    });
    return () => {
      window.clearInterval(timer);
      stopSky();
      stopSound();
      noise.stop();
      settle(() => context.close());
    };
  }, [sky, sound]);
  useEffect(() => {
    const opened = sound.getState().context;
    if (Option.isNone(opened)) {
      return;
    }
    const context = opened.value;
    if (visibility === "visible" && !sound.getState().muted) {
      settle(() => context.resume());
      return;
    }
    settle(() => context.suspend());
  }, [sound, visibility]);
  return null;
}
