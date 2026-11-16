import { Array as Arr, Match } from "effect";
import { unitOf } from "@/lib/island/noise";
import type { Weather } from "@/lib/island/sky";

/**
 * What the island sounds like (ADR 0047, D37): how loud its birds and its
 * crickets are at an hour of the day under a weather, and the notes of each
 * bird's call. The sound module plays them; the day decides them.
 */

/** How loud a voice is at an hour: a soft hill over its own hours of the day, wrapping past midnight. */
function hill(hour: number, from: number, peak: number, to: number) {
  const at = ((hour % 24) + 24) % 24;
  const spread = (to - from + 24) % 24;
  const since = (at - from + 24) % 24;
  if (since > spread) {
    return 0;
  }
  const top = (peak - from + 24) % 24;
  return since <= top ? since / top : 1 - (since - top) / (spread - top);
}

/** Whether rain, a storm or snow is falling, which quiets every bird and cricket. */
function isFalling(weather: Weather) {
  return weather === "rain" || weather === "storm" || weather === "snow";
}

/**
 * How loud the birds and the crickets are, each from 0 to 1, at an hour of the
 * day (0 to 24) under a weather: a dawn chorus loudest at seven, a quieter
 * day, a second song at dusk, and crickets from dusk through the night.
 * Falling weather quiets both; a grey sky only dims the birds.
 */
export function voicesOf(hour: number, weather: Weather) {
  if (isFalling(weather)) {
    return { birds: 0, crickets: 0 };
  }
  const day = Math.max(
    hill(hour, 5, 7, 11),
    0.45 * hill(hour, 9, 13, 17),
    0.7 * hill(hour, 16, 18.5, 20)
  );
  return {
    birds: weather === "clouds" ? day * 0.6 : day,
    crickets: hill(hour, 19.5, 23, 4.5),
  };
}

/** One note of a call: when it starts after the call begins, how long it sweeps, and the pitch it sweeps from and to, in seconds and hertz. */
const Note = (at: number, length: number, from: number, to: number) => ({
  at,
  from,
  length,
  to,
});

/**
 * The notes of one bird's call, picked by its seed among three songs: a
 * trill of quick falling chirps, a two-note whistle, or a rising question.
 * The same seed always sings the same call, a little higher or lower.
 */
export function callOf(seed: number) {
  const kind = Math.floor(unitOf(67, seed) * 3);
  const pitch = 0.85 + unitOf(67, seed, 1) * 0.35;
  const notes = Match.value(kind).pipe(
    Match.when(0, () =>
      Arr.makeBy(5 + Math.floor(unitOf(67, seed, 2) * 4), (index) =>
        Note(index * 0.085, 0.06, 4200, 3100)
      )
    ),
    Match.when(1, () => [
      Note(0, 0.22, 2600, 2550),
      Note(0.3, 0.3, 2050, 1950),
    ]),
    Match.orElse(() => [
      Note(0, 0.12, 2300, 2400),
      Note(0.16, 0.24, 2400, 3500),
    ])
  );
  return Arr.map(notes, (note) => ({
    ...note,
    from: note.from * pitch,
    to: note.to * pitch,
  }));
}
