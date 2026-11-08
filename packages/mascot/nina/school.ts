import { POP } from "@repo/mascot/color";
import { type Curve, flip } from "@repo/mascot/nina/limb";
import type { Place } from "@repo/mascot/nina/point";
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
  abacus,
  bell,
  cap,
  card,
  chalkAt,
  chalkboard,
  diploma,
  pile,
  pointer,
  ring,
  stamp,
} from "@repo/mascot/nina/supply";
import { sparkle } from "@repo/mascot/sparkle";

/** Where the tip of her arm holds the pointer while she teaches, beside her body. */
const TEACHING_HAND: Place = [190, 152];

/**
 * Teaching: a chalkboard beside her head, and a pointer in her raised arm that
 * follows the chalk as each row is written, then rests on the board while she
 * is pleased with it.
 */
export function teaching(t: number): Pose {
  const p = breathe(REST, t);
  const cycle = t % 5;
  const written = Math.min(3, cycle / 1.2);
  const row = Math.min(2, Math.floor(written));
  const along = cycle < 3.6 ? written - row : 1;
  const tip = chalkAt(row, along);
  const hand: Place = [
    TEACHING_HAND[0] + Math.sin(t * 2.4) * 1.5,
    TEACHING_HAND[1] + Math.sin(t * 3.1) * 2,
  ];
  return {
    ...p,
    above: chalkboard(cycle < 4.6 ? written : 0),
    armL: sway(p.armL, t, 0.3, 1),
    armR: [124, 146, 156, 178, 184, 176, hand[0], hand[1]],
    held: pointer(hand, [tip[0], tip[1] + 3]),
    look: [3.5, -1],
    mood: cycle > 3.6 && cycle < 4.6 ? "proud" : "happy",
    tilt: p.tilt - 2,
  };
}

/** The arms that hold a pile or a frame in front of her, from either side, their tips at the height `y`. */
function holding(y: number): readonly [Curve, Curve] {
  const arm = armLeft(20, 166, 28, y + 14, 66, y);
  return [arm, flip(arm)];
}

/** Carrying a pile of books, with a little bounce in every step and the top book tipping. */
export function carrying(t: number): Pose {
  const step = Math.abs(Math.sin(t * 4.2));
  const [armL, armR] = holding(204 - step * 2);
  return {
    ...REST,
    armL,
    armR,
    held: pile(Math.sin(t * 4.2) * 5),
    layer: ["front", "front"],
    legs: swayLegs(REST.legs, t * 2.6, 1.3),
    lift: REST.lift - step * 5,
    look: [Math.sin(t * 1.3) * 2, -2],
    mood: "happy",
    tilt: Math.sin(t * 4.2) * 2,
  };
}

/** Where the foot of the stamp is at a moment of its round: lifted, coming down hard, resting on the card, then lifted again. */
function stampFoot(round: number): Place {
  if (round < 1.1) {
    return [114, 174 - Math.sin((round / 1.1) * Math.PI) * 4];
  }
  if (round < 1.35) {
    const fall = (round - 1.1) / 0.25;
    return [114 - 10 * fall, 174 + 22 * fall * fall];
  }
  if (round < 1.9) {
    return [104, 196];
  }
  const rise = (round - 1.9) / 0.5;
  return [104 + 10 * rise, 196 - 22 * rise];
}

/** Stamping a report card: the card in one arm, a stamp that comes down on it, and the seal it leaves. */
export function stamping(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 2.4;
  const foot = stampFoot(round);
  const sealed = round > 1.35 ? Math.min(1, (round - 1.35) / 0.2) : 0;
  return {
    ...p,
    armL: armLeft(22, 162, 30, 212, 70, 204),
    armR: [124, 146, 224, 130, 200, 252, foot[0] + 15, foot[1] - 6],
    held: [
      ...card(sealed),
      ...stamp(foot[0], foot[1]),
      ...(round > 1.35 && round < 2 ? [sparkle(130, 180, 6, POP.yellow)] : []),
    ],
    layer: ["front", "front"],
    lift: p.lift + (round > 1.33 && round < 1.45 ? 2 : 0),
    look: [0, 3],
    mood: round > 1.35 ? "proud" : "focused",
  };
}

/** Graduating: a cap between her ears, the diploma held high, and a hop for joy. */
export function graduating(t: number): Pose {
  const hop = Math.abs(Math.sin(t * 3.6));
  const wave = Math.sin(t * 3.6);
  const hand: Place = [204 + wave * 3, 58 - hop * 4];
  return {
    ...REST,
    above: [sparkle(232, 30 + wave * 3, 6, POP.yellow)],
    armL: sway(REST.armL, t, 0.3, 1.2),
    armR: armRight(16, 160, -18, 112, 204 - hand[0], hand[1]),
    held: [...cap(wave), ...diploma(hand[0], hand[1] - 8)],
    legs: swayLegs(REST.legs, t * 2, 1),
    lift: REST.lift - hop * 9,
    look: [2, -2.5],
    mood: "laughing",
  };
}

/** Ringing the school bell: the bell held high and swung from side to side, with its ring on the side it reaches. */
export function ringing(t: number): Pose {
  const p = breathe(REST, t);
  const swing = Math.sin(t * 7) * 24;
  const hand: Place = [210, 30 + Math.cos(t * 7) * 2];
  return {
    ...p,
    above:
      Math.abs(swing) > 12
        ? ring(hand[0] + (swing > 0 ? 18 : -18), hand[1] + 16, swing)
        : [],
    armL: sway(p.armL, t, 0.3, 1),
    armR: [124, 146, 196, 166, 238, 110, hand[0], hand[1]],
    held: bell(hand[0], hand[1], swing),
    look: [3, -2],
    mood: "laughing",
    tilt: p.tilt - 3,
  };
}

/** Counting on an abacus: her arms hold its frame while one bead after another slides across. */
export function counting(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 6;
  const [armL, armR] = holding(198);
  const moved = (rod: number) =>
    round < 5.2 ? Math.max(0, Math.min(4, round * 1.8 - rod * 2.4)) : 0;
  return {
    ...p,
    armL,
    armR,
    held: abacus([moved(0), moved(1), moved(2)]),
    layer: ["front", "front"],
    look: [((round * 0.9) % 2) * 3 - 3, 3],
    mood: round > 4.4 && round < 5.2 ? "aha" : "calm",
  };
}
