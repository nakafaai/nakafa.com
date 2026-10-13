import type { Curve } from "@repo/mascot/nina/limb";
import { armLeft, armRight, type Pose, REST } from "@repo/mascot/nina/pose";
import { Schema } from "effect";

/**
 * Seen over an edge, her head and her shoulders show, and her two arms reach
 * out of her body and rest their tips on the edge. The things she does there
 * move only those arms and her face. The edge is at y = 170 of her own figure.
 */
export const EdgeSchema = Schema.Literals(["gripping", "greeting", "drumming"]);

/** Her at rest, with her arms where she puts them. */
function reach(armL: Curve, armR: Curve): Pose {
  return { ...REST, armL, armR };
}

/** Holding on to the edge. */
function gripping(t: number): Pose {
  return reach(
    armLeft(52, 150, 30, 158, 20, 163 + Math.sin(t * 1.4)),
    armRight(52, 150, 30, 158, 20, 163 + Math.sin(t * 1.4 + 2))
  );
}

/** One arm lets go of the edge and waves. */
function greeting(t: number): Pose {
  const w = Math.sin(t * 8);
  return {
    ...reach(
      armLeft(52, 150, 30, 158, 20, 163),
      armRight(46, 156, 14 - w * 3, 152, 12 - w * 6, 130)
    ),
    mood: "happy",
  };
}

/** Both arms drum on the edge. */
function drumming(t: number): Pose {
  const d = Math.sin(t * 20);
  return {
    ...reach(
      armLeft(
        52,
        150,
        30,
        158 - Math.max(0, d) * 5,
        20,
        163 - Math.max(0, d) * 9
      ),
      armRight(
        52,
        150,
        30,
        158 - Math.max(0, -d) * 5,
        20,
        163 - Math.max(0, -d) * 9
      )
    ),
    mood: "laughing",
  };
}

/** Each act answers her pose at time t. `still` is the moment that shows it best. */
export const EDGES = {
  drumming: { pose: drumming, still: 0.1 },
  greeting: { pose: greeting, still: 0.2 },
  gripping: { pose: gripping, still: 0.3 },
} satisfies Record<
  typeof EdgeSchema.Type,
  { readonly pose: (t: number) => Pose; readonly still: number }
>;
