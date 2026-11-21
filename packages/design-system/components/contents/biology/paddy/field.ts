import type { Plant } from "@repo/design-system/components/contents/biology/paddy/oxygen";
import { XRAY } from "@repo/design-system/components/contents/biology/paddy/xray";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Schema } from "effect";
import { Matrix4, Quaternion, Vector3 } from "three";

/**
 * Where the plants of each crop stand, in metres: transplanted rice in hills
 * 20 cm apart each way (IRRI's usual 20 x 20 cm), and maize 25 cm apart in
 * rows 75 cm apart.
 */
export const SPACING = {
  dryland: { across: 0.25, along: 0.75 },
  rice: { across: 0.2, along: 0.2 },
} as const;

/** How far in front of the X-ray zone the nearest row stands, and how far back the crop runs, in metres. */
const ROWS = { first: 0.3, last: -12 } as const;

/** How far the crop runs to either side at the nearest row, in metres; it widens by 1.2 m a metre back. */
const SPAN = 1.8;

/** How far from the middle of the X-ray zone a plant's roots are drawn, in metres. */
const ROOTED = 0.62;

/** Beyond this far back, in metres, plants are drawn plainest. */
const DISTANT = -2.4;

/**
 * One plant of the crop: where it stands on the surface (x, z), how it is
 * turned about the vertical (yaw, in radians), how tall it grows against the
 * rest, whether the X-ray view shows its roots, and the detail it is drawn in.
 */
const HillSchema = Schema.Struct({
  detail: Schema.Literals(["distant", "far", "near"]),
  height: Schema.Finite,
  rooted: Schema.Boolean,
  x: Schema.Finite,
  yaw: Schema.Finite,
  z: Schema.Finite,
});
export type Hill = typeof HillSchema.Type;

/** How far a point on the surface lies from the middle of the X-ray zone. */
function fromZone(x: number, z: number) {
  return Math.hypot(x - XRAY.zone[0], z - XRAY.zone[1]);
}

/**
 * Every plant of the crop, from the nearest row back to the haze, the rows
 * widening with distance to fill the view. Plants over the X-ray zone show
 * their roots and are drawn in full detail; the next few metres plainer, and
 * the rest plainest.
 */
export function cropHills(plant: Plant): readonly Hill[] {
  const { across, along } = SPACING[plant];
  const rows = Arr.range(0, Math.floor((ROWS.first - ROWS.last) / along));
  return Arr.flatMap(rows, (row) => {
    const line = ROWS.first - row * along;
    const reach = Math.floor((SPAN + 1.2 * Math.max(0, -line)) / across);
    return Arr.map(Arr.range(-reach, reach), (column) => {
      const x = column * across + (hashUnit(column, row) - 0.5) * 0.03;
      const z = line + (hashUnit(row, column) - 0.5) * 0.03;
      const rooted = fromZone(x, z) < ROOTED;
      return {
        detail: rooted ? "near" : detailBehind(z),
        height: 0.9 + 0.2 * hashUnit(column, row + 5),
        rooted,
        x,
        yaw: hashUnit(column + 17, row) * Math.PI * 2,
        z,
      };
    });
  });
}

/** Which plainer detail a plant `z` metres back is drawn in. */
function detailBehind(z: number): Hill["detail"] {
  return z > DISTANT ? "far" : "distant";
}

/** The plants whose roots the X-ray view shows. */
export function rootedHills(plant: Plant) {
  return Arr.filter(cropHills(plant), (hill) => hill.rooted);
}

/** The matrix that stands a plant's shape, or its roots, at its hill. */
export function hillMatrix(hill: Hill, matrix = new Matrix4()) {
  return matrix.compose(
    new Vector3(hill.x, 0, hill.z),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), hill.yaw),
    new Vector3(1, 1, 1)
  );
}
