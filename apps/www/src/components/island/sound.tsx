"use client";

import { Array as Arr, Option } from "effect";
import { use } from "react";
import { type GameStoreApi, GameStoreContext } from "@/components/island/store";
import { fallOf } from "@/lib/island/sky";

/** How loud the sea and the rain are under the cues. */
const AMBIENCE = { rain: 0.05, sea: 0.035 } as const;

/** Two seconds of white noise, the stuff waves, rain and digging are made of. */
function noiseOf(audio: AudioContext) {
  const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 7;
  for (let index = 0; index < samples.length; index += 1) {
    seed = (seed * 48_271) % 2_147_483_647;
    samples[index] = (seed / 2_147_483_647) * 2 - 1;
  }
  return buffer;
}

/** A looping noise through one filter into its own gain, silent until the ambience raises it. */
function bed(
  audio: AudioContext,
  noise: AudioBuffer,
  type: BiquadFilterType,
  frequency: number,
  out: AudioNode
) {
  const source = audio.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  const gain = audio.createGain();
  gain.gain.value = 0;
  source.connect(filter).connect(gain).connect(out);
  source.start();
  return gain;
}

/**
 * The island's sound (ADR 0047, D8), synthesized in Web Audio with no file: a
 * wooden knock when a block is placed, a gritty crunch when one is dug, the sea
 * rolling under everything, and rain when it rains. It starts at the learner's
 * first press, as browsers ask, and follows the game's switch.
 */
function startSound(store: GameStoreApi) {
  const audio = new AudioContext();
  const master = audio.createGain();
  master.connect(audio.destination);
  const noise = noiseOf(audio);
  const sea = bed(audio, noise, "lowpass", 420, master);
  const rain = bed(audio, noise, "highpass", 2200, master);
  const swell = audio.createOscillator();
  const depth = audio.createGain();
  swell.frequency.value = 0.12;
  depth.gain.value = AMBIENCE.sea * 0.6;
  swell.connect(depth).connect(sea.gain);
  swell.start();

  const settle = () => {
    const { muted, weather } = store.getState();
    const now = audio.currentTime;
    master.gain.setTargetAtTime(muted ? 0 : 1, now, 0.1);
    sea.gain.setTargetAtTime(AMBIENCE.sea, now, 0.5);
    rain.gain.setTargetAtTime(
      Option.isSome(fallOf(weather)) && weather !== "snow" ? AMBIENCE.rain : 0,
      now,
      0.8
    );
  };

  /** A short knock: a falling tone with a click on top. */
  const knock = () => {
    const now = audio.currentTime;
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(360, now);
    tone.frequency.exponentialRampToValueAtTime(170, now + 0.09);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    tone.connect(gain).connect(master);
    tone.start(now);
    tone.stop(now + 0.13);
  };

  /** A crunch: two bursts of filtered noise. */
  const crunch = () => {
    Arr.forEach([0, 0.05], (delay, index) => {
      const now = audio.currentTime + delay;
      const source = audio.createBufferSource();
      source.buffer = noise;
      const filter = audio.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = index === 0 ? 1400 : 700;
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      source.connect(filter).connect(gain).connect(master);
      source.start(now, delay * 7);
      source.stop(now + 0.1);
    });
  };

  settle();
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.muted !== previous.muted || state.weather !== previous.weather) {
      settle();
    }
    if (state.pending.length > previous.pending.length && !state.muted) {
      Option.map(Arr.last(state.pending), (edit) =>
        edit.after === 0 ? crunch() : knock()
      );
    }
  });
  return () => {
    unsubscribe();
    audio.close();
  };
}

/** Starts the island's sound at the learner's first press, and stops it when the game closes. */
export function IslandSound() {
  const store = use(GameStoreContext);
  if (store === null) {
    throw new Error("IslandSound must be used within the island game");
  }
  return (
    <span
      hidden
      ref={(node) => {
        if (node === null) {
          return;
        }
        let stop: ReturnType<typeof startSound> = () => undefined;
        const begin = () => {
          window.removeEventListener("pointerdown", begin);
          stop = startSound(store);
        };
        window.addEventListener("pointerdown", begin);
        return () => {
          window.removeEventListener("pointerdown", begin);
          stop();
        };
      }}
    />
  );
}
