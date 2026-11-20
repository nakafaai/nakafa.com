"use client";

import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr, DateTime, Option } from "effect";
import { createPatter } from "@/components/island/patter";
import type { GameStoreApi } from "@/components/island/store";
import { GameStoreContext } from "@/components/island/store";
import { createTread } from "@/components/island/tread";
import { callOf, voicesOf } from "@/lib/island/chorus";
import { unitOf } from "@/lib/island/noise";
import { roofShareOf } from "@/lib/island/patter";
import { fallOf, hourOf } from "@/lib/island/sky";
import { thundersBetween } from "@/lib/island/storm";
import { gustAt, WIND_FORCE } from "@/lib/island/wind";

/** How often the storm's next thunders are looked up, and how far ahead they are scheduled, in seconds. */
const THUNDER_LOOK = 1;
const THUNDER_AHEAD = 2;

/** How loud the sea, the rain, the wind, a bird and the crickets are under the cues. */
const AMBIENCE = {
  bird: 0.05,
  crickets: 0.012,
  patter: 0.06,
  rain: 0.05,
  sea: 0.035,
  wind: 0.045,
} as const;

/** Where the wind is heard from: the middle of the learner's island. */
const EAR = 32;

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
 * rolling under everything, a wind that rises with each gust, birds by day and
 * crickets by night (D37), rain when it rains, pattering on the roofs as
 * much as the village has roofs (D42), thunder after a storm's
 * lightning, late by the distance it crossed, and the fox's footsteps on
 * whatever it walks over (D40). It starts at the learner's
 * first press, as browsers ask, and follows the game's switch.
 */
function startSound(store: GameStoreApi) {
  const audio = new AudioContext();
  const master = audio.createGain();
  master.connect(audio.destination);
  const noise = noiseOf(audio);
  const tread = createTread(audio, noise, master);
  const patter = createPatter(audio, master);
  let roofs = roofShareOf(store.getState().cells);
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
    const raining = Option.isSome(fallOf(weather)) && weather !== "snow";
    rain.gain.setTargetAtTime(raining ? AMBIENCE.rain : 0, now, 0.8);
    // A village roofed over a quarter of its land patters as loud as it can.
    patter(raining ? AMBIENCE.patter * Math.min(1, roofs * 4) : 0);
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

  /**
   * A roll of thunder at an audio time: deep noise that swells, rolls a
   * second time and dies away, higher and louder after a near strike.
   */
  const thunder = (
    at: number,
    roll: ReturnType<typeof thundersBetween>[number]
  ) => {
    const source = audio.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(roll.pitch, at);
    filter.frequency.exponentialRampToValueAtTime(80, at + roll.length);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(roll.loud, at + 0.12);
    gain.gain.exponentialRampToValueAtTime(roll.loud * 0.4, at + 0.7);
    gain.gain.exponentialRampToValueAtTime(roll.loud * 0.65, at + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + roll.length);
    source.connect(filter).connect(gain).connect(master);
    source.start(at, (roll.at * 7) % 2);
    source.stop(at + roll.length + 0.1);
  };

  /** One bird's call at an audio time: each note a short sine sweep with a soft attack. */
  const sing = (at: number, seed: number, loud: number) => {
    Arr.forEach(callOf(seed), (note) => {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.type = "sine";
      tone.frequency.setValueAtTime(note.from, at + note.at);
      tone.frequency.exponentialRampToValueAtTime(
        note.to,
        at + note.at + note.length
      );
      gain.gain.setValueAtTime(0.0001, at + note.at);
      gain.gain.exponentialRampToValueAtTime(loud, at + note.at + 0.015);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        at + note.at + note.length
      );
      tone.connect(gain).connect(master);
      tone.start(at + note.at);
      tone.stop(at + note.at + note.length + 0.02);
    });
  };

  // The wind blows louder as a gust's front crosses the island (D32); the crickets are a high trill pulsed in groups.
  const wind = bed(audio, noise, "bandpass", 480, master);
  const crickets = audio.createOscillator();
  const trill = audio.createOscillator();
  const pulse = audio.createGain();
  const chirping = audio.createGain();
  crickets.frequency.value = 4600;
  trill.type = "square";
  trill.frequency.value = 14;
  pulse.gain.value = 0;
  chirping.gain.value = 0;
  trill.connect(pulse.gain);
  crickets.connect(pulse).connect(chirping).connect(master);
  crickets.start();
  trill.start();

  // The thunders come from the same strikes the painter flashes, on the same clock (D33).
  let heardUntil = performance.now() / 1000;
  const listen = () => {
    const now = performance.now() / 1000;
    const until = now + THUNDER_AHEAD;
    const { weather } = store.getState();
    if (weather === "storm") {
      Arr.forEach(thundersBetween(heardUntil, until), (roll) =>
        thunder(audio.currentTime + Math.max(0, roll.at - now), roll)
      );
    }
    heardUntil = until;
    const hour = hourOf(DateTime.nowUnsafe(), DateTime.zoneMakeLocal());
    const voices = voicesOf(hour, weather);
    const gust = gustAt(EAR, EAR, now) * WIND_FORCE[weather];
    wind.gain.setTargetAtTime(
      AMBIENCE.wind * (0.25 + gust),
      audio.currentTime,
      0.6
    );
    // The crickets swell and pause every few seconds, as a field of them does.
    const swell = 0.6 + 0.4 * Math.sin(now * 0.9);
    chirping.gain.setTargetAtTime(
      AMBIENCE.crickets * voices.crickets * swell,
      audio.currentTime,
      0.4
    );
    // A bird calls now and then, more often at dawn: the second decides, so every learner hears the same morning.
    const second = Math.floor(now);
    if (unitOf(61, second) < voices.birds * 0.3) {
      sing(
        audio.currentTime + unitOf(61, second, 1) * 0.8,
        second,
        AMBIENCE.bird * (0.5 + 0.5 * voices.birds)
      );
    }
  };
  const listening = window.setInterval(listen, THUNDER_LOOK * 1000);

  settle();
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.revision !== previous.revision) {
      roofs = roofShareOf(state.cells);
    }
    if (
      state.muted !== previous.muted ||
      state.weather !== previous.weather ||
      state.revision !== previous.revision
    ) {
      settle();
    }
    if (state.steps > previous.steps && !state.muted) {
      tread(state.footing);
    }
    if (state.pending.length > previous.pending.length && !state.muted) {
      Option.map(Arr.last(state.pending), (edit) =>
        edit.after === 0 ? crunch() : knock()
      );
    }
  });
  return () => {
    unsubscribe();
    window.clearInterval(listening);
    audio.close();
  };
}

/** Starts the island's sound at the learner's first press, and stops it when the game closes. */
export function IslandSound() {
  const store = useRequired(GameStoreContext, "IslandSound");
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
