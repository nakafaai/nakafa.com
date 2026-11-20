import { Schema } from "effect";
import { unitOf } from "@/lib/island/noise";

/**
 * The recordings the world plays (ADR 0050, W8): every bed, call and effect
 * is a file under `public/island/audio`, cut from a recording in the public
 * domain or under CC0 that `SOURCES.md` beside the files lists. Nothing is
 * synthesized: this module names the files and says how one is played.
 */
export const Recording = Schema.Literals([
  "bell",
  "birds",
  "bubble",
  "buffalo",
  "bulbul",
  "chime",
  "click",
  "crab",
  "deer",
  "dig",
  "dolphin",
  "duck",
  "egret",
  "fall",
  "fire",
  "frog",
  "frogs",
  "goat",
  "gull",
  "hen",
  "kite",
  "koshi",
  "leaves",
  "meow",
  "music-guitar",
  "music-piano",
  "night",
  "note",
  "page",
  "pop",
  "rabbit",
  "rain",
  "river",
  "roof",
  "rooster",
  "sea",
  "spark",
  "splash",
  "step-grass",
  "step-sand",
  "step-stone",
  "step-wood",
  "thud",
  "thunder",
  "whoosh",
  "wind",
]);
export type Recording = typeof Recording.Type;

/** Where the browser reads a recording from. */
export function addressOf(recording: Recording) {
  return `/island/audio/${recording}.m4a`;
}

/**
 * One play of a recording: how loud, from 0 to 1; how fast, 1 as recorded,
 * which also moves its pitch; how many seconds after now it starts; after how
 * many seconds it is cut short, 0 for the whole of it; and where it sits
 * between the left ear (-1) and the right (1).
 */
export const Shot = Schema.Struct({
  cut: Schema.Finite,
  delay: Schema.Finite,
  file: Recording,
  loud: Schema.Finite,
  pan: Schema.Finite,
  rate: Schema.Finite,
});
export type Shot = typeof Shot.Type;

/** One play of a recording as it was recorded, now, in the middle, whole, with what `over` changes of that. */
export function shotOf(
  file: Recording,
  loud: number,
  over: Partial<Omit<Shot, "file" | "loud">> = {}
): Shot {
  return { cut: 0, delay: 0, file, loud, pan: 0, rate: 1, ...over };
}

/** The steps of the scale every tune is played in, in semitones over C: a major pentatonic, where any two notes sound well together. */
const SCALE = [0, 2, 4, 7, 9] as const;

/** The pitch each sampled bar was recorded at, in hertz: a marimba bar and a glockenspiel bar. */
const TUNED = { chime: 3172.7, note: 783.3 } as const;

/** The pitch of a degree of the scale in an octave over middle C, in hertz. */
function pitchOf(degree: number, octave: number) {
  const step = SCALE[((degree % 5) + 5) % 5];
  return 261.63 * 2 ** ((step + 12 * (Math.floor(degree / 5) + octave)) / 12);
}

/**
 * One note of a tune: a sampled bar played faster or slower until it sounds a
 * degree of the scale, the marimba bar (`note`) for small things and the
 * glockenspiel bar (`chime`) for rare ones, `delay` seconds from now.
 */
export function noteOf(
  bar: keyof typeof TUNED,
  degree: number,
  octave: number,
  delay: number,
  loud: number
) {
  return shotOf(bar, loud, {
    delay,
    rate: pitchOf(degree, octave) / TUNED[bar],
  });
}

/**
 * How much faster or slower one play of a sound runs than the last, within
 * `cents` hundredths of a semitone either way, so a sound heard often never
 * repeats itself exactly. The same seed and count always give the same bend.
 */
export function bendOf(seed: number, count: number, cents: number) {
  return 2 ** (((unitOf(seed, count) * 2 - 1) * cents) / 1200);
}
