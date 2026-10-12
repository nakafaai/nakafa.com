import { free } from "@repo/mascot/nina/ink";
import { type Curve, flip } from "@repo/mascot/nina/limb";
import { at } from "@repo/mascot/nina/point";
import {
  armLeft,
  armRight,
  breathe,
  type Pose,
  REST,
  sway,
} from "@repo/mascot/nina/pose";
import { balls, confetti, dots, sleep } from "@repo/mascot/nina/prop";
import {
  guarding,
  reading,
  searching,
  typing,
  writing,
} from "@repo/mascot/nina/work";
import { Array as Arr, Schema } from "effect";

/** The things she does when all of her is shown. */
export const ActSchema = Schema.Literals([
  "relaxed",
  "waving",
  "reading",
  "typing",
  "writing",
  "guarding",
  "thinking",
  "searching",
  "pointing",
  "juggling",
  "cheering",
  "sleeping",
  "hanging",
]);

/** Doing nothing in particular. */
function relaxed(t: number): Pose {
  const p = breathe(REST, t);
  return {
    ...p,
    armL: sway(p.armL, t, 0.3, 1),
    armR: sway(p.armR, t, 2.1, -1),
  };
}

/** Hello: one arm up, its tip going from side to side. */
function waving(t: number): Pose {
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
    mood: "happy",
    tilt: p.tilt - 2.5,
  };
}

/** A leg with its tip lifted. */
function lifted(leg: Curve, by: number): Curve {
  return [leg[0], leg[1], leg[2], leg[3], leg[4], leg[5], leg[6], leg[7] - by];
}

/** Thinking: the tip of one arm at her chin, a thought over her head. The loading state. */
function thinking(t: number): Pose {
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
    mood: "thoughtful",
    tilt: p.tilt + 2,
  };
}

/** Hooray: both arms up, a hop, paper in the air. */
function cheering(t: number): Pose {
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
    mood: "laughing",
  };
}

/** Asleep, with both arms on her belly. */
function sleeping(t: number): Pose {
  const deep = Math.sin(t * 1.2);
  return {
    ...REST,
    above: sleep(t),
    armL: armLeft(38, 172, 40, 208 + deep, 22, 206 + deep),
    armR: armRight(38, 172, 40, 208 + deep, 22, 206 + deep),
    lift: REST.lift + (4 + deep * 2),
    mood: "asleep",
    tilt: REST.tilt + 7,
  };
}

/** Pointing at something beside her. */
function pointing(t: number): Pose {
  const p = breathe(REST, t);
  const reach = Math.max(0, Math.sin(t * 5)) * 7;
  return {
    ...p,
    above: [
      free(`M${at(232 + reach, 124)} L${at(240 + reach, 116)}`),
      free(`M${at(236 + reach, 138)} L${at(246 + reach, 138)}`),
      free(`M${at(232 + reach, 152)} L${at(240 + reach, 160)}`),
    ],
    armL: sway(p.armL, t, 0.3, 1),
    armR: [124, 146, 176, 148, 198 + reach, 154, 220 + reach, 138],
    look: [4, 0],
    mood: "happy",
    tilt: p.tilt - 3,
  };
}

/** Juggling three balls. */
function juggling(t: number): Pose {
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
    mood: "happy",
  };
}

/** Picked up: everything hangs. */
function hanging(t: number): Pose {
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
    mood: "surprised",
  };
}

/**
 * Each act answers her pose at time t, in seconds since it began. `still` is
 * the moment that shows the act best in a picture that does not move.
 */
export const ACTS = {
  cheering: { pose: cheering, still: 0.35 },
  guarding: { pose: guarding, still: 1.4 },
  hanging: { pose: hanging, still: 0.2 },
  juggling: { pose: juggling, still: 0.3 },
  pointing: { pose: pointing, still: 0.3 },
  reading: { pose: reading, still: 1.2 },
  relaxed: { pose: relaxed, still: 0.4 },
  searching: { pose: searching, still: 0.7 },
  sleeping: { pose: sleeping, still: 1.2 },
  thinking: { pose: thinking, still: 0.5 },
  typing: { pose: typing, still: 0.2 },
  waving: { pose: waving, still: 0.2 },
  writing: { pose: writing, still: 1.6 },
} satisfies Record<
  typeof ActSchema.Type,
  { readonly pose: (t: number) => Pose; readonly still: number }
>;
