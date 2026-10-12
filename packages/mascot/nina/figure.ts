import { NINA, POP } from "@repo/mascot/color";
import {
  ARM,
  FIN,
  HALF_BOX,
  HEAD,
  LEANS,
  LEG,
  PALE,
  type SideSchema,
  TORSO,
  WHOLE_BOX,
} from "@repo/mascot/nina/body";
import { face, type Look, type MoodSchema } from "@repo/mascot/nina/face";
import { type Curve, exit, limb } from "@repo/mascot/nina/limb";
import {
  type LimbName,
  limbOf,
  type Mark,
  partOf,
} from "@repo/mascot/nina/mark";
import {
  BEHAVIORS,
  homeOf,
  type Mode,
  modeOf,
  moodOf,
  type Options,
} from "@repo/mascot/nina/options";
import { type Pose, REST } from "@repo/mascot/nina/pose";
import { tenth } from "@repo/mascot/round";
import { group, path, rect, type Shape } from "@repo/mascot/shape";
import { Array as Arr } from "effect";

/** The limbs below her body, left to right. */
const LEG_NAMES = ["leg0", "leg1", "leg2", "leg3"] as const;

/** Where a point of her upper body is once she has shifted, lifted and tilted. */
export function place(
  { lift, shift, tilt }: Pick<Pose, "lift" | "shift" | "tilt">,
  x: number,
  y: number
) {
  const a = (tilt * Math.PI) / 180;
  const dx = x - 102;
  const dy = y - 210;
  return [
    102 + dx * Math.cos(a) - dy * Math.sin(a) + shift,
    210 + dx * Math.sin(a) + dy * Math.cos(a) + lift,
  ] as const;
}

/** Moves her upper body: shifted, lifted and tilted about her feet. */
function upper({ lift, shift, tilt }: Pick<Pose, "lift" | "shift" | "tilt">) {
  return `translate(${tenth(shift)} ${tenth(lift)}) rotate(${tenth(tilt)} 102 210)`;
}

/** A leg in the room she stands in: its root moves with her body, its tip stays on the floor. */
export function legCurve(
  pose: Pick<Pose, "legs" | "lift" | "shift" | "tilt">,
  index: number
): Curve {
  const c = pose.legs[index];
  const root = place(pose, c[0], c[1]);
  return [
    root[0],
    root[1],
    c[2] + pose.shift * 0.6,
    c[3] + pose.lift * 0.6,
    c[4],
    c[5],
    c[6],
    c[7],
  ];
}

/** One tentacle, drawn whole. */
function tentacle(name: LimbName, c: Curve, girth: typeof ARM) {
  return path({ d: limb(c, girth), fill: NINA.body, mark: limbOf(name) });
}

/** The part of an arm that is drawn on top, from where it has left her body. */
function over(name: LimbName, c: Curve) {
  return path({
    d: limb(c, ARM, exit(c, ARM)),
    fill: NINA.body,
    mark: limbOf(name),
  });
}

/**
 * Her figure for one pose. `mode` says how much of her the window shows: all
 * of her, a tile (her limbs are below the frame and are left out) or over an
 * edge (her arms reach out to rest on it, and her fin is left out because an
 * arm lies where it would show).
 *
 * Each arm is drawn whole behind her body. The part of it that lies on her body
 * or over what she holds is drawn once more on top, from a point where it has
 * left her body, so where the two meet nothing shows.
 */
function figure(
  pose: Pose,
  mood: typeof MoodSchema.Type,
  look: Look,
  mode: Mode
): readonly Shape<Mark>[] {
  const arms = mode !== "tile";
  return [
    group(
      mode === "whole"
        ? Arr.map(LEG_NAMES, (name, i) =>
            tentacle(name, legCurve(pose, i), LEG)
          )
        : [],
      { mark: partOf("legs") }
    ),
    group(
      [
        ...(mode === "peek" ? [] : [path({ d: FIN, fill: NINA.body })]),
        group(
          arms
            ? [
                tentacle("armL", pose.armL, ARM),
                tentacle("armR", pose.armR, ARM),
              ]
            : [],
          { mark: partOf("back") }
        ),
        path({ d: TORSO, fill: NINA.body }),
        path({ d: HEAD, fill: NINA.body }),
        path({ d: PALE, fill: NINA.face }),
        group(face(mood, look), { mark: partOf("face") }),
        group(pose.held, { mark: partOf("held") }),
        group(
          arms
            ? [
                ...(pose.layer[0] === "front"
                  ? [over("overL", pose.armL)]
                  : []),
                ...(pose.layer[1] === "front"
                  ? [over("overR", pose.armR)]
                  : []),
              ]
            : [],
          { mark: partOf("front") }
        ),
      ],
      { mark: partOf("upper"), transform: upper(pose) }
    ),
    group(pose.above, { mark: partOf("above") }),
  ];
}

/** Where she looks, seen from the side she faces: a mirrored figure looks the other way. */
export function viewed(
  side: typeof SideSchema.Type | undefined,
  look: Look
): Look {
  return side === "left" ? [-look[0], look[1]] : look;
}

/**
 * Puts her figure in its window: mirrored when she faces left, and in a tile,
 * leaning in from a corner or standing in the middle. Answers the window and
 * the shapes in it.
 */
export function compose(
  options: Options,
  pose: Pose,
  mood: typeof MoodSchema.Type,
  look: Look
) {
  const mode = modeOf(options);
  const mirror = (shapes: readonly Shape<Mark>[]) =>
    options.side === "left"
      ? [group(shapes, { transform: "translate(204 0) scale(-1 1)" })]
      : shapes;
  if (options.whole === true) {
    return {
      box: WHOLE_BOX,
      shapes: mirror(figure(pose, mood, look, mode)),
    };
  }
  const lean = LEANS[options.lean ?? "center"];
  const transform = `translate(${100 + lean.x} ${200 + lean.y}) rotate(${lean.turn}) scale(${lean.size}) translate(-102 -200)`;
  const drawn = mirror(figure(pose, mood, look, mode));
  if (options.tile === undefined) {
    return { box: HALF_BOX, shapes: [group(drawn, { transform })] };
  }
  // The ground of a tile is hers, so a line that stands free on it is drawn in
  // her ink and not in the colour of the page's text.
  return {
    box: HALF_BOX,
    shapes: [
      rect({ fill: POP[options.tile], height: 200, width: 200 }),
      group(drawn, { color: NINA.ink, transform }),
    ],
  };
}

/**
 * Her at one moment of her act, in her window. `act` is the pose her act has
 * then: it says her face and, for some acts, where her eyes look. `drawn` is
 * the pose her limbs are drawn in, the same in a still picture and where her
 * springs hold them while she lives; in a tile her limbs are out of the window
 * and she is drawn at rest. `gaze` is where the options or the pointer ask her
 * eyes to look, and `glad` the face that a press shows for a moment.
 *
 * The still picture and the first frame of her life both come from here, so
 * they cannot differ.
 */
export function appear(
  options: Options,
  act: Pose,
  drawn: Pose,
  gaze: Look,
  glad?: typeof MoodSchema.Type
) {
  return compose(
    options,
    modeOf(options) === "tile" ? REST : drawn,
    moodOf(options, act, glad),
    act.look ?? viewed(options.side, gaze)
  );
}

/** Her, as options ask for her, at the moment they pick. */
export function scene(options: Options) {
  const behavior = BEHAVIORS[homeOf(options)];
  const act = behavior.pose(options.t ?? behavior.still);
  return appear(options, act, act, options.look ?? [0, 0]);
}
