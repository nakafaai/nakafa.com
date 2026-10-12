import { ACTS, ActSchema } from "@repo/design-system/components/nina/act";
import {
  ARM,
  type CutSchema,
  FIN,
  HALF_BOX,
  HEAD,
  LEANS,
  LEG,
  LeanSchema,
  n1,
  PALE,
  SideSchema,
  TORSO,
  WHOLE_BOX,
} from "@repo/design-system/components/nina/body";
import { BODY, FACE } from "@repo/design-system/components/nina/color";
import { EDGES, EdgeSchema } from "@repo/design-system/components/nina/edge";
import {
  face,
  type Look,
  LookSchema,
  MoodSchema,
} from "@repo/design-system/components/nina/face";
import {
  type Curve,
  exit,
  limb,
} from "@repo/design-system/components/nina/limb";
import { type Pose, REST } from "@repo/design-system/components/nina/pose";
import {
  group,
  type LimbName,
  path,
  rect,
  type Shape,
} from "@repo/design-system/components/nina/shape";
import { Array as Arr, Schema } from "effect";

/** The colors a tile can have behind her. */
const GroundSchema = Schema.Literals([
  "pop-blue",
  "pop-cream",
  "pop-green",
  "pop-orange",
  "pop-red",
  "pop-yellow",
]);

/** The limbs below her body, left to right. */
const LEG_NAMES = ["leg0", "leg1", "leg2", "leg3"] as const;

const Shared = {
  look: Schema.optionalKey(LookSchema),
  mood: Schema.optionalKey(MoodSchema),
  side: Schema.optionalKey(SideSchema),
  t: Schema.optionalKey(Schema.Finite),
};

/**
 * What the drawing needs to know. Whole, she is drawn doing `act`. Otherwise
 * she is the same figure seen through a smaller window, the way the profile
 * animals are: she rises from the bottom of the frame, standing in the middle
 * or leaning in from a lower corner (`lean`: kanan, kiri), and the frame cuts
 * her body, never her head. `lean: "intip"` is her looking over the bottom edge
 * with the tips of her arms resting on it. `side: "kiri"` mirrors her, fin and
 * all. `t` picks the moment of the act; left out, it is the moment that shows
 * the act best. `fidget` lists the acts that she may do for a moment by
 * herself, now and then, when she is alive.
 */
const OptionsSchema = Schema.Union([
  Schema.Struct({
    ...Shared,
    act: Schema.optionalKey(ActSchema),
    fidget: Schema.optionalKey(Schema.Array(ActSchema)),
    whole: Schema.Literal(true),
  }),
  Schema.Struct({
    ...Shared,
    act: Schema.optionalKey(EdgeSchema),
    fidget: Schema.optionalKey(Schema.Array(EdgeSchema)),
    lean: Schema.optionalKey(LeanSchema),
    tile: Schema.optionalKey(GroundSchema),
    whole: Schema.optionalKey(Schema.Literal(false)),
  }),
]);

export type Options = typeof OptionsSchema.Type;

/** Where a point of her upper body is once she has shifted, lifted and tilted. */
function place(
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
  return `translate(${n1(shift)} ${n1(lift)}) rotate(${n1(tilt)} 102 210)`;
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
  return path({ d: limb(c, girth), fill: BODY, limb: name });
}

/** The part of an arm that is drawn on top, from where it has left her body. */
function over(name: LimbName, c: Curve) {
  return path({ d: limb(c, ARM, exit(c, ARM)), fill: BODY, limb: name });
}

/**
 * Her figure for one pose. `cut` says how much of her the window shows: all of
 * her, a tile (her limbs are below the frame and are left out) or over an edge
 * (her arms reach out to rest on it, and her fin is left out because an arm
 * lies where it would show).
 *
 * Each arm is drawn whole behind her body. The part of it that lies on her body
 * or over what she holds is drawn once more on top, from a point where it has
 * left her body, so where the two meet nothing shows.
 */
function figure(
  pose: Pose,
  mood: typeof MoodSchema.Type,
  look: Look,
  cut: typeof CutSchema.Type
): readonly Shape[] {
  const arms = cut !== "bust";
  return [
    group(
      cut === "whole"
        ? Arr.map(LEG_NAMES, (name, i) =>
            tentacle(name, legCurve(pose, i), LEG)
          )
        : [],
      { part: "legs" }
    ),
    group(
      [
        ...(cut === "peek" ? [] : [path({ d: FIN, fill: BODY })]),
        group(
          arms
            ? [
                tentacle("armL", pose.armL, ARM),
                tentacle("armR", pose.armR, ARM),
              ]
            : [],
          { part: "back" }
        ),
        path({ d: TORSO, fill: BODY }),
        path({ d: HEAD, fill: BODY }),
        path({ d: PALE, fill: FACE }),
        group(face(mood, look), { part: "face" }),
        group(pose.held, { part: "held" }),
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
          { part: "front" }
        ),
      ],
      { part: "upper", transform: upper(pose) }
    ),
    group(pose.above, { part: "above" }),
  ];
}

/** Where she looks, seen from the side she faces: a mirrored figure looks the other way. */
export function viewed(
  side: typeof SideSchema.Type | undefined,
  look: Look
): Look {
  return side === "kiri" ? [-look[0], look[1]] : look;
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
  const mirrored = options.side === "kiri";
  const mirror = (shapes: readonly Shape[]) =>
    mirrored
      ? [group(shapes, { transform: "translate(204 0) scale(-1 1)" })]
      : shapes;
  if (options.whole === true) {
    return {
      box: WHOLE_BOX,
      shapes: mirror(figure(pose, mood, look, "whole")),
    };
  }
  const lean = LEANS[options.lean ?? "tengah"];
  const placed = group(
    mirror(
      figure(pose, mood, look, options.lean === "intip" ? "peek" : "bust")
    ),
    {
      transform: `translate(${100 + lean.x} ${200 + lean.y}) rotate(${lean.turn}) scale(${lean.size}) translate(-102 -200)`,
    }
  );
  return {
    box: HALF_BOX,
    shapes:
      options.tile === undefined
        ? [placed]
        : [
            rect({ fill: `var(--${options.tile})`, height: 200, width: 200 }),
            placed,
          ],
  };
}

/** Her, as options ask for her, at the moment they pick. */
export function scene(options: Options) {
  const look = viewed(options.side, options.look ?? [0, 0]);
  if (options.whole === true) {
    const act = ACTS[options.act ?? "santai"];
    const pose = act.pose(options.t ?? act.still);
    return compose(
      options,
      pose,
      options.mood ?? pose.mood ?? "halo",
      pose.look ?? look
    );
  }
  const edge = EDGES[options.act ?? "pegang"];
  const pose =
    options.lean === "intip" ? edge.pose(options.t ?? edge.still) : REST;
  return compose(options, pose, options.mood ?? "halo", look);
}
