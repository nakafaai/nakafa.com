import type { Verdict } from "@repo/design-system/components/contents/mathematics/counterexample/claim";
import type { Place } from "@repo/design-system/components/contents/mathematics/counterexample/layout";
import { carryAt } from "@repo/design-system/components/contents/mathematics/counterexample/sweep";
import { Array as Arr, Schema } from "effect";

/**
 * How one tile lies at one moment of the check: where it is, how high it is
 * held, how far it turns its face up to the camera, how much it darkens, and
 * how strongly the spot under it shows.
 */
const PoseSchema = Schema.Struct({
  dim: Schema.Number,
  lift: Schema.Number,
  spot: Schema.Number,
  tilt: Schema.Number,
  x: Schema.Number,
  z: Schema.Number,
});
type Pose = typeof PoseSchema.Type;

/** How a picked tile is held up: how high it rises and how far it turns its face to the camera, in metres and radians. */
const PICK = { lift: 0.034, tilt: 0.85 } as const;

/** How a counterexample, or an example of "some", stands up once it is checked. */
const STAND = { lift: 0.02, tilt: 0.5 } as const;

/** How high the tile being checked rises while the answer stays hidden. */
const SCAN = 0.008;

/** The verdicts whose tile stands up: the one tile that can settle the claim. */
const STANDING: readonly Verdict[] = ["breaks", "proves"];

/** The verdicts whose tile darkens: one the claim says nothing about. */
const RECEDING: readonly Verdict[] = ["outside", "safe"];

/**
 * How one tile lies, from how far its check has come (`checked`, from 0 to
 * 1, which stays 0 while the answer is hidden), whether the learner holds it
 * up, and whether it is the tile being checked. A checked tile is carried
 * from its spot in the grid to its spot on the case board, when it has one;
 * a counterexample or an example stands up; a tile outside the claim
 * darkens. A held tile rises above all of them and turns to the camera.
 */
export function poseOf({
  checked,
  from,
  held,
  scanning,
  to,
  verdict,
}: {
  readonly checked: number;
  readonly from: Place;
  readonly held: boolean;
  readonly scanning: boolean;
  readonly to: Place;
  readonly verdict: Verdict;
}): Pose {
  const point = carryAt(from, to, checked);
  const stands = Arr.contains(STANDING, verdict) ? checked : 0;
  const scan = scanning && checked === 0 ? SCAN : 0;
  return {
    dim: Arr.contains(RECEDING, verdict) ? checked : 0,
    lift: point.y + scan + (held ? PICK.lift : STAND.lift * stands),
    spot: held ? 1 : checked,
    tilt: held ? PICK.tilt : STAND.tilt * stands,
    x: point.x,
    z: point.z,
  };
}
