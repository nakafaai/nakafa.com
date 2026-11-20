import { Array as Arr, Schema } from "effect";
import type { Shot } from "@/lib/island/tape";
import { bendOf, noteOf, shotOf } from "@/lib/island/tape";

/**
 * What the learner's own acts sound like (ADR 0050, W8): the cues the game
 * answers a change with, read from what changed in the game's store, and the
 * recordings each cue plays.
 */
export const Cue = Schema.Literals([
  "bite",
  "brush",
  "cast",
  "catch",
  "escaped",
  "mode",
  "notice",
  "pet",
  "place",
  "shake",
  "sheet",
  "stars",
  "take",
  "turn",
  "undo",
]);
export type Cue = typeof Cue.Type;

/** What the fox does that changes nothing in the world: it casts a line, strokes an animal, shakes a tree. */
export const Deed = Schema.Literals(["cast", "pet", "shake"]);
export type Deed = typeof Deed.Type;

/**
 * What the sound hears of the game at one moment: how many blueprints are
 * open, how many fish the learner caught today, the fox's latest deed and how
 * many it did, what the learner's hands do, the notice the HUD shows, how
 * many steps undo holds, how many operations wait for the server and what the
 * latest of them did, the sheet open over the world, and the turn of the
 * thing in hand.
 */
export const Heard = Schema.Struct({
  blueprints: Schema.Int,
  catches: Schema.Int,
  deed: Deed,
  deeds: Schema.Int,
  last: Schema.Literals(["land", "none", "set", "take"]),
  mode: Schema.String,
  notice: Schema.NullOr(Schema.String),
  past: Schema.Int,
  pending: Schema.Int,
  sheet: Schema.NullOr(Schema.String),
  turn: Schema.Int,
});
export type Heard = typeof Heard.Type;

/** The cue each kind of operation is heard as: a stroke of a brush, a thing set down, a thing taken. */
const ACTS = { land: "brush", set: "place", take: "take" } as const;

/** The cue of a new notice: a bite and an escape have their own, every other one says the press did not take. */
function noticeCue(notice: string): Cue {
  if (notice === "bite" || notice === "escaped") {
    return notice;
  }
  return "notice";
}

/** The cue of what the learner did to the world between two moments, none when the world did not change: an undo when a step left the history, else what the latest operation did. */
function actCue(before: Heard, after: Heard): readonly Cue[] {
  if (after.pending <= before.pending || after.last === "none") {
    return [];
  }
  return [after.past < before.past ? "undo" : ACTS[after.last]];
}

/**
 * The cues between two moments of the game (ADR 0050, W8): what the learner
 * did to the world, a thing turned in hand, a deed of the fox, a catch
 * landed, a new notice, a blueprint opened with Stars, the hands changed and
 * a sheet opened.
 */
export function cuesOf(before: Heard, after: Heard): readonly Cue[] {
  return Arr.flatten([
    actCue(before, after),
    after.turn === before.turn ? [] : ["turn" as const],
    after.deeds > before.deeds ? [after.deed] : [],
    after.catches > before.catches ? ["catch" as const] : [],
    after.notice !== null && after.notice !== before.notice
      ? [noticeCue(after.notice)]
      : [],
    after.blueprints > before.blueprints ? ["stars" as const] : [],
    after.mode === before.mode ? [] : ["mode" as const],
    after.sheet !== null && after.sheet !== before.sheet
      ? ["sheet" as const]
      : [],
  ]);
}

/**
 * The recordings a cue plays (ADR 0050, W8), as the prototype the owner
 * approved played them. `run` counts the cues of its kind that came close
 * together before it: each thing set down in a row climbs one step of the
 * scale, and no two dabs of a brush sound quite alike.
 *
 * - place: a dull thud of wood set on earth, then a note of the marimba.
 * - take: a pop, then a low note.
 * - brush: a scrape of earth, and a soft note that walks the scale.
 * - turn: a whoosh. undo: a quicker whoosh, taken back.
 * - cast: the line through the air, then the float on the water.
 * - bite: two bubbles. catch: a splash, then two notes of the glockenspiel.
 * - escaped: a small quick splash. notice: two notes falling.
 * - pet: a small bell. shake: leaves.
 * - mode: a click. sheet: a page turned.
 * - stars: a spark and four notes rising into wind chimes.
 */
export function shotsOf(cue: Cue, run: number): readonly Shot[] {
  const tunes: Record<Cue, readonly Shot[]> = {
    bite: [
      shotOf("bubble", 0.6),
      shotOf("bubble", 0.5, { delay: 0.14, rate: 1.2 }),
    ],
    brush: [
      shotOf("dig", 0.3, { rate: bendOf(41, run, 260) }),
      noteOf("note", run % 10, 1, 0, 0.1),
    ],
    cast: [
      shotOf("whoosh", 0.3, { rate: 1.5 }),
      shotOf("splash", 0.25, { cut: 0.3, delay: 0.35, rate: 1.6 }),
    ],
    catch: [
      shotOf("splash", 0.5),
      noteOf("chime", 2, 2, 0.1, 0.3),
      noteOf("chime", 4, 2, 0.26, 0.3),
    ],
    escaped: [shotOf("splash", 0.3, { cut: 0.4, rate: 1.4 })],
    mode: [shotOf("click", 0.35)],
    notice: [noteOf("note", 1, 0, 0, 0.3), noteOf("note", 0, 0, 0.14, 0.3)],
    pet: [shotOf("bell", 0.3, { rate: 1.2 })],
    place: [
      shotOf("thud", 0.9, { rate: 0.9 }),
      noteOf("note", run % 8, 1, 0.04, 0.35),
    ],
    shake: [shotOf("leaves", 0.5)],
    sheet: [shotOf("page", 0.4)],
    stars: [
      shotOf("spark", 0.6),
      ...Arr.makeBy(4, (step) => noteOf("note", step + 1, 1, step * 0.07, 0.3)),
      shotOf("koshi", 0.4, { delay: 0.3 }),
    ],
    take: [
      shotOf("pop", 0.5, { rate: bendOf(43, run, 150) }),
      noteOf("note", 2, 0, 0.05, 0.25),
    ],
    turn: [shotOf("whoosh", 0.4, { rate: 0.8 })],
    undo: [shotOf("whoosh", 0.3, { rate: 1.35 * bendOf(47, run, 100) })],
  };
  return tunes[cue];
}
