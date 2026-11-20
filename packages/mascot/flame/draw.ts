import { NINA, POP, TEXT, WHITE } from "@repo/mascot/color";
import { tenth } from "@repo/mascot/round";
import type { Shape } from "@repo/mascot/shape";
import { ellipse, group, path } from "@repo/mascot/shape";
import { sparkle } from "@repo/mascot/sparkle";
import { Array as Arr } from "effect";

/** The three tongues of a flame, from the widest to its heart, drawn round one foot. */
const BACK =
  "M63,18 C70,34 88,43 88,62 C88,75 76,83 60,83 C44,83 32,75 32,62 C32,52 37,45 42,39 C44,46 48,50 53,50 C50,39 54,27 63,18 Z";
const BODY =
  "M61,26 C66,38 81,45 81,61 C81,73 72,81 60,81 C48,81 39,73 39,61 C39,53 43,47 47,42 C49,48 52,51 56,51 C54,42 56,33 61,26 Z";
const HEART =
  "M61,49 C64,56 71,60 71,68 C71,75 66,79 60,79 C54,79 49,75 49,68 C49,63 52,60 54,57 C55,60 57,61 59,61 C58.4,57 59.4,53 61,49 Z";

/** Where the sparks of a great flame fly, nearest the flame first, and how big each is. */
const SPARKS = [
  [96, 40, 5],
  [22, 52, 4.4],
  [86, 16, 3.6],
  [30, 22, 4],
  [104, 70, 3.4],
  [14, 84, 3.2],
] as const;

/** How far the tongues of a flame of a stage reach before it is sized: left, top and right of its foot at 60, 83. */
function reachOf(stage: number) {
  if (stage >= 7) {
    return { left: 19.5, right: 100.5, top: 1 };
  }
  if (stage >= 5) {
    return { left: 19.5, right: 100.5, top: 18 };
  }
  return stage >= 3
    ? { left: 32, right: 88, top: 18 }
    : { left: 39, right: 81, top: 26 };
}

/**
 * The window that holds the flame of a stage and its sparks and nothing more,
 * so its first tongue stands on the same ruler as the text beside it.
 */
export function flameBox(stage: number) {
  if (stage < 1) {
    return [29, 34, 62, 88] as const;
  }
  const size = sizeOf(stage);
  const reach = reachOf(stage);
  const sparks = Arr.take(SPARKS, Math.max(0, stage - 3));
  const left = Math.min(
    60 + (reach.left - 60) * size,
    ...Arr.map(sparks, ([x, , far]) => x - far * 1.3)
  );
  const right = Math.max(
    60 + (reach.right - 60) * size,
    ...Arr.map(sparks, ([x, , far]) => x + far * 1.3)
  );
  const top = Math.min(
    122 + (reach.top - 83) * size,
    ...Arr.map(sparks, ([, y, far]) => y - far * 1.3)
  );
  return [
    tenth(left - 1),
    tenth(top - 1),
    tenth(right - left + 2),
    tenth(122 - top + 2),
  ] as const;
}

/** The colours of a flame: warm until it has burnt for a long time, then blue. */
function coloursOf(stage: number) {
  return stage < 9
    ? {
        back: POP.red,
        body: POP.orange,
        core: stage < 6 ? WHITE : NINA.body,
        heart: stage < 8 ? POP.yellow : WHITE,
        spark: POP.yellow,
      }
    : {
        back: POP.blue,
        body: NINA.body,
        core: WHITE,
        heart: NINA.face,
        spark: NINA.body,
      };
}

/** How large a flame of a stage stands in its window, from a spark to its full height. */
function sizeOf(stage: number) {
  return Math.round(Math.min(1.3, 0.74 + stage * 0.14) * 100) / 100;
}

/** The window an ember is drawn in: one small flame, or its coals, and nothing round it. */
export const EMBER_BOX = [30, 20, 60, 66] as const;

/**
 * Draws one day of a week of learning: a small flame for a day the learner
 * learned on, and cold coals in the colour of the text round them for a day
 * they did not, with no smoke, so a week of them stays quiet. It is the flame's own body, in a window as small as it is.
 */
export function ember(lit: boolean): readonly Shape[] {
  if (lit) {
    return [
      path({ d: BODY, fill: POP.orange }),
      path({ d: HEART, fill: POP.yellow }),
      ellipse({ cx: 60, cy: 72, fill: WHITE, rx: 4.4, ry: 5.2 }),
    ];
  }
  return [
    group(
      [
        ellipse({ cx: 49, cy: 76, fill: TEXT, rx: 11, ry: 6 }),
        ellipse({ cx: 71, cy: 76, fill: TEXT, rx: 11, ry: 6 }),
        ellipse({ cx: 60, cy: 69, fill: TEXT, rx: 11, ry: 6 }),
      ],
      { opacity: 0.22 }
    ),
  ];
}

/** A fire that has gone out: three coals and a wisp of smoke, in the colour of the text round it. */
function cold(): readonly Shape[] {
  return [
    group(
      [
        ellipse({ cx: 44, cy: 112, fill: TEXT, rx: 15, ry: 8 }),
        ellipse({ cx: 76, cy: 112, fill: TEXT, rx: 15, ry: 8 }),
        ellipse({ cx: 60, cy: 104, fill: TEXT, rx: 15, ry: 8 }),
      ],
      { opacity: 0.22 }
    ),
    path({
      d: "M60,88 C52,78 68,70 60,60 C54,52 64,46 60,38",
      fill: "none",
      opacity: 0.22,
      stroke: TEXT,
      strokeLinecap: "round",
      strokeWidth: 5,
    }),
  ];
}

/**
 * Draws the flame of a run of days at its stage (ADR 0047, D31). At stage 0
 * the fire is out: coals and smoke in the colour of the text round it. From
 * stage 1 it burns, and every stage adds to it, so a longer run always looks
 * greater: it grows taller, gains a third tongue, then sparks, then licks at
 * its sides, a blue heart, a taller crown of fire, a white-hot heart, and at
 * last it burns blue. Only fire and sparks, with no ring or ray round it. Stages have no end; past the last change a flame keeps its full form.
 */
export function flame(stage: number): readonly Shape[] {
  if (stage < 1) {
    return cold();
  }
  const colours = coloursOf(stage);
  const size = sizeOf(stage);
  const sparks = Arr.take(SPARKS, Math.max(0, stage - 3));
  return [
    group(
      [
        ...(stage < 5
          ? []
          : [
              path({
                d: BODY,
                fill: colours.back,
                transform: "translate(0 40.5) scale(0.5)",
              }),
              path({
                d: BODY,
                fill: colours.back,
                transform: "translate(120 40.5) scale(-0.5 0.5)",
              }),
            ]),
        ...(stage < 7
          ? []
          : [
              path({
                d: BACK,
                fill: colours.back,
                transform: "translate(-9 -21.6) scale(1.15 1.26)",
              }),
            ]),
        ...(stage < 3 ? [] : [path({ d: BACK, fill: colours.back })]),
        path({ d: BODY, fill: colours.body }),
        path({ d: HEART, fill: colours.heart }),
        ellipse({ cx: 60, cy: 72, fill: colours.core, rx: 4.4, ry: 5.2 }),
      ],
      { transform: `translate(60 122) scale(${size}) translate(-60 -83)` }
    ),
    ...Arr.map(sparks, ([x, y, far]) => sparkle(x, y, far, colours.spark)),
  ];
}
