import { fractalAt } from "@repo/design-system/components/three/field/noise";
import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import { moundBody } from "@repo/design-system/components/three/organism/mound";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr } from "effect";
import { Color } from "three";

const SKIN = new Color(CLASSIFICATION_COLORS.seaStar);
const PALE = new Color(CLASSIFICATION_COLORS.seaStarPale);
const HORN = new Color(CLASSIFICATION_COLORS.seaStarSpike);

/** How far an arm's tip and the notch between two arms lie from the middle. */
const TIP = 0.3;
const NOTCH = 0.115;

/** Half the angle between two arms. */
const HALF = Math.PI / 5;

/** How far a `turn` lies from the axis of the nearest of the five arms, in radians. */
function offAxis(turn: number) {
  const angle = turn * 2 * Math.PI;
  return Math.abs(angle - Math.round(angle / (2 * HALF)) * 2 * HALF);
}

/**
 * The outline of a horned sea star: five stout arms that taper straight
 * from a broad disc to blunt, rounded tips.
 */
export function starRim(turn: number) {
  const off = offAxis(turn);
  const edge =
    (TIP * NOTCH * Math.sin(HALF)) /
    (TIP * Math.sin(off) + NOTCH * Math.sin(HALF - off));
  return edge * (1 - 0.1 * Math.max(0, 1 - off / 0.12) ** 2);
}

/**
 * Where the horns stand, as distance from the middle, height and width:
 * a ring of five tall ones round the disc and a row that shrinks down each
 * arm, the pattern the species is named for.
 */
const HORNS = [
  { high: 0.062, out: 0.07, round: 0.026 },
  { high: 0.04, out: 0.135, round: 0.02 },
  { high: 0.028, out: 0.19, round: 0.016 },
  { high: 0.018, out: 0.236, round: 0.012 },
] as const;

/** How tall the horns stand at a place `reach` from the middle and `off` its arm's axis. */
function horns(reach: number, off: number) {
  const across = reach * Math.sin(off);
  const along = reach * Math.cos(off);
  return Arr.reduce(HORNS, 0, (tallest, horn) => {
    const from = Math.hypot(across, along - horn.out) / horn.round;
    return Math.max(tallest, horn.high * Math.max(0, 1 - from) ** 0.8);
  });
}

/**
 * How tall a horned sea star stands at a place: a thick disc and arms that
 * are ridged along their middle, with its horns on top.
 */
export function starHeight(out: number, turn: number) {
  const reach = out * starRim(turn);
  const body = 0.062 * (1 - out * out) ** 0.55 * (1 - 0.62 * (reach / TIP));
  return body + horns(reach, offAxis(turn)) * (1 - out ** 6);
}

/**
 * A horned sea star (Protoreaster nodosus) as one body: tan to orange-red
 * skin, mottled and paler at the edges, with dark brown horns.
 */
export function starForms(detail: number): readonly Form[] {
  return [
    moundBody({
      height: starHeight,
      paint: (out, turn, color) => {
        const reach = out * starRim(turn);
        const horn = Math.min(1, horns(reach, offAxis(turn)) * 28) ** 2;
        const mottle = fractalAt(turn, out, 15, 6, 71, 3);
        color
          .copy(SKIN)
          .lerp(PALE, Math.min(1, Math.max(0, mottle * 1.6 - 0.5 + out ** 3)))
          .lerp(HORN, horn);
      },
      rim: starRim,
      rings: faces(64, detail),
      spokes: faces(300, detail),
    }),
  ];
}
