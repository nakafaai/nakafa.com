import { n1 } from "@repo/design-system/components/nina/body";
import { POP } from "@repo/design-system/components/nina/color";
import { type Curve, flip } from "@repo/design-system/components/nina/limb";
import { ink, sparkle } from "@repo/design-system/components/nina/mark";
import {
  armLeft,
  armRight,
  breathe,
  type Pose,
  REST,
  sway,
  swayLegs,
} from "@repo/design-system/components/nina/pose";
import {
  balls,
  book,
  confetti,
  dots,
  keyboard,
  lens,
  lock,
  onPad,
  pad,
  pencil,
  sleep,
} from "@repo/design-system/components/nina/prop";
import { Array as Arr, Schema } from "effect";

/** The things she does when all of her is shown. */
export const ActSchema = Schema.Literals([
  "santai",
  "melambai",
  "membaca",
  "mengetik",
  "menulis",
  "menjaga",
  "berpikir",
  "mencari",
  "menunjuk",
  "main",
  "merayakan",
  "tidur",
  "gantung",
]);

/** Doing nothing in particular. */
function santai(t: number): Pose {
  const p = breathe(REST, t);
  return {
    ...p,
    armL: sway(p.armL, t, 0.3, 1),
    armR: sway(p.armR, t, 2.1, -1),
  };
}

/** Hello: one arm up, its tip going from side to side. */
function melambai(t: number): Pose {
  const p = breathe(REST, t);
  const w = Math.sin(t * 7.5);
  return {
    ...p,
    armL: sway(p.armL, t, 0.3, 1),
    armR: [
      124,
      146,
      190,
      166,
      232 + w * 5,
      122,
      220 + w * 14,
      60 + Math.cos(t * 7.5) * 3,
    ],
    mood: "senang",
    tilt: p.tilt - 2.5,
  };
}

/** The key of the keyboard that an arm comes down on. */
function column(x: number) {
  return Math.max(0, Math.min(8, Math.round((x - 42) / 15)));
}

/** Typing: both arms on the keys. Every few seconds she gets going and types in a burst. */
function mengetik(t: number): Pose {
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
    mood: burst ? "senang" : "fokus",
  };
}

/** Reading: a book in both arms, eyes going along the line, a page turned every few seconds. */
function membaca(t: number): Pose {
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
    mood: Math.floor(t / 3.8) % 3 === 2 && round < 1.1 ? "paham" : "tenang",
  };
}

/** Keeping something safe: a padlock in both arms that clicks shut. */
function menjaga(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 4;
  // Open for a moment at the start of every round, then it drops shut.
  const open = round < 0.5 ? 1 : round < 0.68 ? 1 - (round - 0.5) / 0.18 : 0;
  const click =
    round > 0.68 && round < 0.9
      ? Math.sin(((round - 0.68) / 0.22) * Math.PI)
      : 0;
  return {
    ...p,
    armL: armLeft(22, 162, 30, 206, 74, 194),
    armR: armRight(22, 162, 30, 206, 74, 194),
    held: [
      ...lock(open),
      ...(round > 0.68 && round < 1.5
        ? [sparkle(131, 153, 5.5 + click * 2, POP.yellow)]
        : []),
    ],
    layer: ["front", "front"],
    lift: p.lift + click * 2.5,
    look: [0, 3],
    mood: round < 0.68 ? "fokus" : round < 1.6 ? "bangga" : "kedip",
  };
}

/** A leg with its tip lifted. */
function lifted(leg: Curve, by: number): Curve {
  return [leg[0], leg[1], leg[2], leg[3], leg[4], leg[5], leg[6], leg[7] - by];
}

/** Thinking: the tip of one arm at her chin, a thought over her head. The loading state. */
function berpikir(t: number): Pose {
  const p = breathe(REST, t);
  return {
    ...p,
    above: dots(t),
    armL: sway(p.armL, t, 0.3, 0.6),
    armR: armRight(-16, 140, 48, 236, 90, 128 + Math.sin(t * 5) * 2),
    layer: ["back", "front"],
    // One leg taps the floor while she waits.
    legs: Arr.map(p.legs, (leg, i) =>
      i === 1 ? lifted(leg, Math.max(0, Math.sin(t * 6)) * 7) : leg
    ),
    look: [0, 0],
    mood: "mikir",
    tilt: p.tilt + 2,
  };
}

/** Writing: a notepad in one arm, a pencil in the other. */
function menulis(t: number): Pose {
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
    mood: cycle > 3.3 && cycle < 3.9 ? "bangga" : "fokus",
  };
}

/** Hooray: both arms up, a hop, paper in the air. */
function merayakan(t: number): Pose {
  const w = Math.sin(t * 9);
  return {
    ...REST,
    above: confetti(t),
    armL: armLeft(16, 162, -22, 110 + w * 4, -6 + w * 9, 54),
    armR: armRight(16, 162, -22, 110 - w * 4, -6 - w * 9, 54),
    legs: Arr.map(REST.legs, (leg, i) => sway(leg, t * 3, i * 1.3, 1.2)),
    lift:
      REST.lift -
      Math.abs(Math.sin(t * 4.6)) * 13 * Math.max(0.25, 1 - (t % 2.4) / 2.4),
    mood: "tertawa",
  };
}

/** Asleep, with both arms on her belly. */
function tidur(t: number): Pose {
  const deep = Math.sin(t * 1.2);
  return {
    ...REST,
    above: sleep(t),
    armL: armLeft(38, 172, 40, 208 + deep, 22, 206 + deep),
    armR: armRight(38, 172, 40, 208 + deep, 22, 206 + deep),
    lift: REST.lift + (4 + deep * 2),
    mood: "tidur",
    tilt: REST.tilt + 7,
  };
}

/** Looking for something with a magnifying glass. */
function mencari(t: number): Pose {
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
    mood: t % 4.6 > 3.8 ? "paham" : "tanya",
  };
}

/** Pointing at something beside her. */
function menunjuk(t: number): Pose {
  const p = breathe(REST, t);
  const reach = Math.max(0, Math.sin(t * 5)) * 7;
  return {
    ...p,
    above: [
      ink(`M${n1(232 + reach)},124 L${n1(240 + reach)},116`, 4),
      ink(`M${n1(236 + reach)},138 L${n1(246 + reach)},138`, 4),
      ink(`M${n1(232 + reach)},152 L${n1(240 + reach)},160`, 4),
    ],
    armL: sway(p.armL, t, 0.3, 1),
    armR: [124, 146, 176, 148, 198 + reach, 154, 220 + reach, 138],
    look: [4, 0],
    mood: "senang",
    tilt: p.tilt - 3,
  };
}

/** Juggling three balls. */
function main(t: number): Pose {
  const p = breathe(REST, t);
  const beat = Math.sin((t / 1.5) * Math.PI * 6);
  const left = [0, 134 + beat * 7] as const;
  const right = [204, 134 - beat * 7] as const;
  const juggled = balls(t, left, right);
  return {
    ...p,
    above: juggled.shapes,
    armL: armLeft(36, 178, -4, 184, left[0], left[1] + 12),
    armR: [124, 146, 168, 178, 208, 184, right[0], right[1] + 12],
    look: [
      (juggled.first[0] - 102) / 22,
      Math.max(-4, (juggled.first[1] - 88) / 26),
    ],
    mood: "senang",
  };
}

/** Picked up: everything hangs. */
function gantung(t: number): Pose {
  const s = Math.sin(t * 5) * 5;
  return {
    ...REST,
    armL: armLeft(40, 174, 30 + s * 0.5, 206, 30 + s, 230),
    armR: armRight(40, 174, 30 - s * 0.5, 206, 30 - s, 230),
    legs: [
      [74, 186, 56, 220, 46 + s * 0.6, 244, 48 + s, 264],
      [92, 192, 86, 228, 80 + s * 0.6, 254, 82 + s, 274],
      flip([92, 192, 86, 228, 80 - s * 0.6, 254, 82 - s, 274]),
      flip([74, 186, 56, 220, 46 - s * 0.6, 244, 48 - s, 264]),
    ],
    mood: "kaget",
  };
}

/**
 * Each act answers her pose at time t, in seconds since it began. `still` is
 * the moment that shows the act best in a picture that does not move.
 */
export const ACTS = {
  berpikir: { pose: berpikir, still: 0.5 },
  gantung: { pose: gantung, still: 0.2 },
  main: { pose: main, still: 0.3 },
  melambai: { pose: melambai, still: 0.2 },
  membaca: { pose: membaca, still: 1.2 },
  mencari: { pose: mencari, still: 0.7 },
  mengetik: { pose: mengetik, still: 0.2 },
  menjaga: { pose: menjaga, still: 1.4 },
  menulis: { pose: menulis, still: 1.6 },
  menunjuk: { pose: menunjuk, still: 0.3 },
  merayakan: { pose: merayakan, still: 0.35 },
  santai: { pose: santai, still: 0.4 },
  tidur: { pose: tidur, still: 1.2 },
} satisfies Record<
  typeof ActSchema.Type,
  { readonly pose: (t: number) => Pose; readonly still: number }
>;
