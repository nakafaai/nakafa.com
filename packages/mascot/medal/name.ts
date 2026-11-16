import { NINA, PAGE, POP, SOFT_PINK } from "@repo/mascot/color";
import {
  book,
  compass,
  flame,
  pencils,
  sheet,
} from "@repo/mascot/medal/emblem/learn";
import {
  chip,
  gear,
  nodes,
  pad,
  pulse,
  terminal,
} from "@repo/mascot/medal/emblem/machine";
import {
  atom,
  flask,
  globe,
  pin,
  sprout,
  tiles,
} from "@repo/mascot/medal/emblem/science";
import {
  ballot,
  chart,
  flags,
  glass,
  people,
} from "@repo/mascot/medal/emblem/society";
import type { Ink } from "@repo/mascot/medal/ink";
import type { Shape } from "@repo/mascot/shape";
import { Schema } from "effect";

/**
 * Every medal the product awards, by the name of what it counts: the five
 * kinds of learning first, then each subject by its material domain.
 */
export const MedalSchema = Schema.Literals([
  "days",
  "streak",
  "lessons",
  "sections",
  "sets",
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "geography",
  "economy",
  "history",
  "informatics",
  "geospatial",
  "sociology",
  "ai-ds",
  "game-engineering",
  "computer-science",
  "technology-electro-medical",
  "political-science",
  "informatics-engineering",
  "international-relations",
]);

/**
 * How one medal is drawn: the colour of its face and of its ribbon, the emblem
 * on it, and the colours the emblem takes once the medal is earned. A new medal
 * is one row here, and one drawing of its emblem.
 */
interface Design {
  readonly emblem: (ink: Ink) => readonly Shape[];
  readonly face: string;
  readonly ink: Ink;
  readonly ribbon: string;
}

/** The ink of an emblem on a face: Nina's ink for its dark, the page for its light. */
function inkOf(first: string, second: string, third: string): Ink {
  return { dark: NINA.ink, first, light: PAGE, second, third };
}

export const MEDALS: Record<typeof MedalSchema.Type, Design> = {
  "ai-ds": {
    emblem: nodes,
    face: NINA.ink,
    ink: inkOf(POP.yellow, NINA.body, SOFT_PINK),
    ribbon: NINA.body,
  },
  biology: {
    emblem: sprout,
    face: PAGE,
    ink: inkOf(POP.green, NINA.body, POP.red),
    ribbon: POP.green,
  },
  chemistry: {
    emblem: flask,
    face: POP.orange,
    ink: inkOf(POP.green, POP.yellow, NINA.body),
    ribbon: POP.yellow,
  },
  "computer-science": {
    emblem: terminal,
    face: POP.green,
    ink: inkOf(NINA.ink, POP.red, POP.yellow),
    ribbon: NINA.ink,
  },
  days: {
    emblem: compass,
    face: POP.green,
    ink: inkOf(POP.red, NINA.body, POP.yellow),
    ribbon: POP.blue,
  },
  economy: {
    emblem: chart,
    face: POP.green,
    ink: inkOf(POP.red, POP.yellow, NINA.body),
    ribbon: POP.yellow,
  },
  "game-engineering": {
    emblem: pad,
    face: POP.red,
    ink: inkOf(POP.blue, POP.green, POP.yellow),
    ribbon: NINA.body,
  },
  geography: {
    emblem: globe,
    face: POP.cream,
    ink: inkOf(POP.blue, POP.green, POP.yellow),
    ribbon: POP.green,
  },
  geospatial: {
    emblem: pin,
    face: POP.blue,
    ink: inkOf(POP.orange, POP.cream, POP.red),
    ribbon: POP.orange,
  },
  history: {
    emblem: glass,
    face: NINA.body,
    ink: inkOf(POP.orange, POP.yellow, POP.red),
    ribbon: POP.cream,
  },
  informatics: {
    emblem: chip,
    face: NINA.ink,
    ink: inkOf(POP.green, NINA.body, POP.yellow),
    ribbon: POP.green,
  },
  "informatics-engineering": {
    emblem: gear,
    face: POP.blue,
    ink: inkOf(POP.yellow, POP.orange, NINA.body),
    ribbon: POP.orange,
  },
  "international-relations": {
    emblem: flags,
    face: POP.cream,
    ink: inkOf(POP.red, POP.blue, POP.yellow),
    ribbon: POP.red,
  },
  lessons: {
    emblem: book,
    face: NINA.body,
    ink: inkOf(POP.blue, POP.green, POP.red),
    ribbon: POP.red,
  },
  mathematics: {
    emblem: tiles,
    face: POP.blue,
    ink: inkOf(POP.yellow, SOFT_PINK, NINA.body),
    ribbon: POP.red,
  },
  physics: {
    emblem: atom,
    face: NINA.ink,
    ink: inkOf(POP.yellow, NINA.body, POP.orange),
    ribbon: NINA.body,
  },
  "political-science": {
    emblem: ballot,
    face: POP.orange,
    ink: inkOf(POP.green, NINA.body, POP.yellow),
    ribbon: POP.blue,
  },
  sections: {
    emblem: sheet,
    face: POP.blue,
    ink: inkOf(POP.green, POP.orange, POP.red),
    ribbon: POP.green,
  },
  sets: {
    emblem: pencils,
    face: POP.red,
    ink: inkOf(POP.yellow, NINA.body, SOFT_PINK),
    ribbon: POP.orange,
  },
  sociology: {
    emblem: people,
    face: POP.green,
    ink: inkOf(POP.yellow, POP.yellow, SOFT_PINK),
    ribbon: SOFT_PINK,
  },
  streak: {
    emblem: flame,
    face: NINA.ink,
    ink: inkOf(POP.orange, POP.yellow, POP.red),
    ribbon: POP.red,
  },
  "technology-electro-medical": {
    emblem: pulse,
    face: PAGE,
    ink: inkOf(POP.red, NINA.body, POP.yellow),
    ribbon: POP.red,
  },
};
