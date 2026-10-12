import { POP } from "@repo/mascot/color";
import {
  armLeft,
  armRight,
  breathe,
  type Pose,
  REST,
  sway,
  swayLegs,
} from "@repo/mascot/nina/pose";
import {
  book,
  keyboard,
  lens,
  lock,
  onPad,
  pad,
  pencil,
} from "@repo/mascot/nina/prop";
import { sparkle } from "@repo/mascot/sparkle";

/** The key of the keyboard that an arm comes down on. */
function column(x: number) {
  return Math.max(0, Math.min(8, Math.round((x - 42) / 15)));
}

/** How open the padlock is, at a moment of its round: open for a moment, then it drops shut. */
function opening(round: number) {
  if (round < 0.5) {
    return 1;
  }
  return round < 0.68 ? 1 - (round - 0.5) / 0.18 : 0;
}

/** How she looks, at a moment of the round of the padlock. */
function guardingMood(round: number) {
  if (round < 0.68) {
    return "focused";
  }
  return round < 1.6 ? "proud" : "winking";
}

/** Typing: both arms on the keys. Every few seconds she gets going and types in a burst. */
export function typing(t: number): Pose {
  const burst = t % 5.2 > 3.6;
  const tap = Math.sin(t * (burst ? 24 : 15));
  // Each arm wanders along the keys and comes down on one.
  const lx = 62 + Math.sin(t * 2.3) * 10;
  const rx = 142 + Math.sin(t * 1.9 + 1) * 10;
  return {
    ...REST,
    armL: armLeft(
      32,
      174,
      34,
      218 - Math.max(0, -tap) * 4,
      lx,
      240 - Math.max(0, -tap) * 8
    ),
    armR: [
      124,
      146,
      172,
      174,
      170,
      218 - Math.max(0, tap) * 4,
      rx,
      240 - Math.max(0, tap) * 8,
    ],
    held: keyboard([
      ...(tap < -0.3 ? [[1, column(lx)] as const] : []),
      ...(tap > 0.3 ? [[1, column(rx)] as const] : []),
    ]),
    layer: ["front", "front"],
    legs: swayLegs(REST.legs, t, 0.6),
    lift: REST.lift + Math.abs(tap) * 0.8,
    look: [Math.sin(t * 2.2) * 3, 3.5],
    mood: burst ? "happy" : "focused",
  };
}

/** Reading: a book in both arms, eyes going along the line, a page turned every few seconds. */
export function reading(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 3.8;
  const turn = (round - 2.9) / 0.8;
  const going = turn > 0 && turn < 1 ? Math.sin(turn * Math.PI) : 0;
  return {
    ...p,
    armL: armLeft(22, 162, 30, 208, 68, 196),
    // The tip of her right arm flicks the page up, then takes hold of the book again.
    armR: [
      124,
      146,
      182,
      162,
      174,
      208 - going * 4,
      136 + going * 4,
      196 - going * 10,
    ],
    held: book(turn),
    layer: ["front", "front"],
    // Her eyes go along the line, jump back to the start of the next one, and follow the page over.
    look: going ? [3 - turn * 6, 1.5] : [((t * 0.7) % 1) * 6 - 3, 3],
    // Every third page she finds something good.
    mood: Math.floor(t / 3.8) % 3 === 2 && round < 1.1 ? "aha" : "calm",
  };
}

/** Keeping something safe: a padlock in both arms that clicks shut. */
export function guarding(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 4;
  const click =
    round > 0.68 && round < 0.9
      ? Math.sin(((round - 0.68) / 0.22) * Math.PI)
      : 0;
  return {
    ...p,
    armL: armLeft(22, 162, 30, 206, 74, 194),
    armR: armRight(22, 162, 30, 206, 74, 194),
    held: [
      ...lock(opening(round)),
      ...(round > 0.68 && round < 1.5
        ? [sparkle(131, 153, 5.5 + click * 2, POP.yellow)]
        : []),
    ],
    layer: ["front", "front"],
    lift: p.lift + click * 2.5,
    look: [0, 3],
    mood: guardingMood(round),
  };
}

/** Writing: a notepad in one arm, a pencil in the other. */
export function writing(t: number): Pose {
  const p = breathe(REST, t);
  const cycle = t % 4.4;
  const written = Math.min(3, cycle / 1.1);
  const line = Math.min(2, Math.floor(written));
  const along = cycle < 3.3 ? written - line : 1;
  const point = onPad(
    70 + 40 * along + Math.sin(t * 30) * (cycle < 3.3 ? 1.2 : 0),
    176 + line * 13
  );
  return {
    ...p,
    armL: armLeft(22, 162, 30, 210, 72, 200),
    armR: [124, 146, 224, 130, 200, 252, point[0] + 15, point[1] + 3],
    held: [...pad(cycle < 3.9 ? written : 0), ...pencil(point[0], point[1])],
    layer: ["front", "front"],
    look: [-3, 3],
    mood: cycle > 3.3 && cycle < 3.9 ? "proud" : "focused",
  };
}

/** Looking for something with a magnifying glass. */
export function searching(t: number): Pose {
  const p = breathe(REST, t);
  const x = 200 + Math.sin(t * 1.4) * 12;
  const y = 146 + Math.sin(t * 2.3) * 8;
  return {
    ...p,
    armL: sway(p.armL, t, 0.3, 1),
    armR: [124, 146, 166, 202, x - 2, y + 72, x + 25, y + 37],
    held: lens(x, y),
    layer: ["back", "front"],
    look: [3 + Math.sin(t * 1.4) * 1.5, 2],
    mood: t % 4.6 > 3.8 ? "aha" : "curious",
  };
}
