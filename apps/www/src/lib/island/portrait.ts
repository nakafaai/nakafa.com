import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Schema } from "effect";
import { DISTANCE, type Orbit } from "@/lib/island/camera";
import { viewProjectionOf } from "@/lib/island/matrix";
import { shoreOf } from "@/lib/island/terrain";
import { SEA_LEVEL } from "@/lib/island/world";

/**
 * How the home page frames the learner's world (ADR 0047, D55): from the
 * south-east like the game's opening view, a little higher so the sea round
 * the island reads, with the whole island and `margin` cells of its shore and
 * shelf inside `fill` of the frame, so the highland, the stream's falls, the
 * reef and the waves to the shore all show in one glance.
 */
const PORTRAIT = {
  fill: 0.94,
  margin: 3,
  pitch: 0.8,
  yaw: Math.PI / 4,
} as const;

/** The space the search for the frame's distance still spans: the nearest it may be and the farthest. */
const Range = Schema.Struct({ far: Schema.Finite, near: Schema.Finite });
type Range = typeof Range.Type;

/** The points round the island's farthest shore, and its margin, that the frame must hold. */
const RIM = 32;

/** How many halvings the search for the frame's distance takes; past this the change is under a hundredth of a cell. */
const HALVINGS = 24;

/** The island's portrait camera at `distance` cells back. */
function orbitAt(distance: number): Orbit {
  return {
    distance,
    pitch: PORTRAIT.pitch,
    target: [SPAN / 2, SEA_LEVEL, SPAN / 2],
    yaw: PORTRAIT.yaw,
  };
}

/** Whether every point of a ring `reach` cells round the island's middle shows inside the frame's fill from `orbit`, on a screen of `aspect`. */
function holds(orbit: Orbit, aspect: number, reach: number) {
  const m = viewProjectionOf(orbit, aspect);
  return Arr.every(
    Arr.makeBy(RIM, (index) => (index / RIM) * Math.PI * 2),
    (angle) => {
      const [x, y, z] = [
        SPAN / 2 + Math.cos(angle) * reach,
        SEA_LEVEL,
        SPAN / 2 + Math.sin(angle) * reach,
      ];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      const across = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
      const up = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
      return (
        w > 0 &&
        Math.abs(across) <= PORTRAIT.fill &&
        Math.abs(up) <= PORTRAIT.fill
      );
    }
  );
}

/**
 * The camera the home page draws the learner's island from, on a screen of
 * `aspect` (width over height): the nearest that holds the whole island of
 * this footprint side and its shore, found by halving the space between the
 * camera's nearest and farthest, and never past its farthest.
 */
export function portraitOf(size: number, aspect: number): Orbit {
  const reach = shoreOf(size) + PORTRAIT.margin;
  const start: Range = {
    far: DISTANCE.far,
    near: DISTANCE.near,
  };
  const { far } = Arr.reduce(
    Arr.makeBy(HALVINGS, (step) => step),
    start,
    ({ far: back, near }) => {
      const middle = (near + back) / 2;
      return holds(orbitAt(middle), aspect, reach)
        ? { far: middle, near }
        : { far: back, near: middle };
    }
  );
  return orbitAt(far);
}
