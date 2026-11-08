import type { Operation } from "@repo/backend/confect/island/build";
import { Array as Arr, Match, Option, Schema } from "effect";
import type { Phase, Weather } from "@/lib/island/sky";

/** The instruments the island plays, each synthesized from oscillators (ADR 0042, D19). */
export const Voice = Schema.Literals(["pluck", "pad", "bell", "chime"]);
export type Voice = typeof Voice.Type;

/** The steps of one bar: eight eighth notes. */
export const STEPS_PER_BAR = 8;

/** Each light's mode over its root: bright by day, open at dawn, warm at dusk, hushed at night. */
const MODES = {
  dawn: { root: 62, scale: [0, 2, 4, 7, 9], tempo: 72 },
  day: { root: 60, scale: [0, 2, 4, 5, 7, 9, 11], tempo: 92 },
  dusk: { root: 57, scale: [0, 2, 4, 5, 7, 9, 10], tempo: 80 },
  night: { root: 57, scale: [0, 3, 5, 7, 10], tempo: 60 },
} as const;

/** Each weather's instrument, the octave it plays in, and how often it plays a step. */
const PLAYERS = {
  clear: { density: 0.55, octave: 0, voice: "pluck" },
  cloudy: { density: 0.3, octave: 0, voice: "pad" },
  fog: { density: 0.22, octave: -1, voice: "pad" },
  rain: { density: 0.35, octave: 0, voice: "bell" },
  snow: { density: 0.3, octave: 1, voice: "chime" },
  storm: { density: 0.25, octave: -1, voice: "pad" },
} as const;

/** The chord roots of a four-bar phrase, as degrees of the scale: home, away, rest, lift. */
const PHRASE = [0, 3, 1, 2] as const;

/**
 * A number between 0 and 1 for a bar and a step, the same every time, so the
 * music varies without a random source and a page that opens twice plays the
 * same phrase.
 */
export function chance(bar: number, step: number, salt: number) {
  const value =
    Math.sin(bar * 12.9898 + step * 78.233 + salt * 37.719) * 43_758.5453;
  return value - Math.floor(value);
}

/** The frequency of a MIDI note in hertz. */
export function frequencyOf(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** The seconds one step lasts in a light. */
export function stepSeconds(phase: Phase) {
  return 60 / MODES[phase].tempo / 2;
}

/** The note of a scale degree, any number of octaves up or down. */
function noteOf(phase: Phase, degree: number) {
  const { root, scale } = MODES[phase];
  const octave = Math.floor(degree / scale.length);
  const index = degree - octave * scale.length;
  return root + octave * 12 + Arr.getUnsafe(scale, index);
}

/**
 * The notes of one bar: the chord's root low on the first step, and a melody
 * that wanders the scale near the chord, playing a step when its chance falls
 * under the weather's density. Each note has its step, its MIDI note, its
 * length in steps, how loud it is, and its instrument.
 */
export function barOf(phase: Phase, weather: Weather, bar: number) {
  const player = PLAYERS[weather];
  const chord = PHRASE[bar % PHRASE.length];
  const bass = {
    length: STEPS_PER_BAR,
    midi: noteOf(phase, chord) - 12,
    step: 0,
    velocity: 0.22,
    voice: "pad" as const,
  };
  const melody = Arr.getSomes(
    Arr.map(Arr.range(0, STEPS_PER_BAR - 1), (step) => {
      if (chance(bar, step, 1) >= player.density) {
        return Option.none();
      }
      const degree = chord + Math.floor(chance(bar, step, 2) * 5);
      return Option.some({
        length: player.voice === "pluck" ? 1 : 3,
        midi: noteOf(phase, degree) + 12 * player.octave,
        step,
        velocity: 0.12 + chance(bar, step, 3) * 0.1,
        voice: player.voice,
      });
    })
  );
  return [bass, ...melody];
}

/** How much rain and wind sound, and whether birds or crickets call, in a light and a weather. */
export function ambienceOf(phase: Phase, weather: Weather) {
  const wet = Match.value(weather).pipe(
    Match.when("storm", () => 0.5),
    Match.when("rain", () => 0.3),
    Match.orElse(() => 0)
  );
  const wind = Match.value(weather).pipe(
    Match.when("storm", () => 0.3),
    Match.whenOr("cloudy", "snow", "fog", () => 0.12),
    Match.orElse(() => 0.05)
  );
  const fine = weather === "clear" || weather === "cloudy";
  return {
    birds: fine && (phase === "dawn" || phase === "day"),
    crickets: fine && (phase === "dusk" || phase === "night"),
    rain: wet,
    wind,
  };
}

/** The sounds the island answers a press with. */
export const Cue = Schema.Literals([
  "place",
  "remove",
  "upgrade",
  "water",
  "harvest",
  "refuse",
]);
export type Cue = typeof Cue.Type;

/** Each cue's notes: seconds after the press, MIDI note, seconds long, instrument. */
const CUES = {
  harvest: [
    [0, 72, 0.12, "pluck"],
    [0.08, 76, 0.12, "pluck"],
    [0.16, 79, 0.12, "pluck"],
    [0.24, 84, 0.3, "bell"],
  ],
  place: [
    [0, 67, 0.1, "pluck"],
    [0.06, 74, 0.16, "pluck"],
  ],
  refuse: [
    [0, 50, 0.12, "pluck"],
    [0.1, 49, 0.2, "pluck"],
  ],
  remove: [
    [0, 74, 0.1, "pluck"],
    [0.06, 67, 0.16, "pluck"],
  ],
  upgrade: [
    [0, 72, 0.14, "bell"],
    [0.12, 79, 0.14, "bell"],
    [0.24, 84, 0.5, "chime"],
  ],
  water: [
    [0, 84, 0.08, "chime"],
    [0.07, 81, 0.08, "chime"],
    [0.14, 77, 0.1, "chime"],
    [0.22, 72, 0.3, "bell"],
  ],
} as const;

/** The notes of a cue, each with its delay in seconds, MIDI note, length in seconds and instrument. */
export function cueOf(cue: Cue) {
  return Arr.map(CUES[cue], ([delay, midi, length, voice]) => ({
    delay,
    length,
    midi,
    voice,
  }));
}

/** The cue an accepted edit plays, by what its first change does. */
export function cueOfEdit(operation: Operation["_tag"]): Cue {
  return Match.value(operation).pipe(
    Match.whenOr("place", "move", () => "place" as const),
    Match.whenOr("remove", "downgrade", () => "remove" as const),
    Match.when("upgrade", () => "upgrade" as const),
    Match.exhaustive
  );
}
