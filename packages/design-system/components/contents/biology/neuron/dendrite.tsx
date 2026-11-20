import {
  SOMA,
  TRUNKS,
} from "@repo/design-system/components/contents/biology/neuron/soma";
import {
  rounded,
  sweep,
  TissueMaterial,
  useOwned,
} from "@repo/design-system/components/contents/biology/neuron/tissue";
import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { NEURON_COLORS } from "@repo/design-system/lib/material/neuron";
import { Array as Arr, Schema } from "effect";
import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** One segment of a dendrite, between the cell body or a fork and the next fork or its tip. */
const BranchSchema = Schema.Struct({
  direction: Schema.instanceOf(Vector3),
  length: Schema.Finite,
  level: Schema.Finite,
  radius: Schema.Tuple([Schema.Finite, Schema.Finite]),
  seed: Schema.Finite,
  start: Schema.instanceOf(Vector3),
});
type Branch = typeof BranchSchema.Type;

/** How many times a dendrite forks before it ends. */
const FORKS = 2;

/** `direction` turned by `angle` radians about an axis across it chosen by `seed`. */
function turn(direction: Vector3, angle: number, seed: number) {
  const across = new Vector3(
    hashUnit(seed, 1) - 0.5,
    hashUnit(seed, 2) - 0.5,
    0.3 * (hashUnit(seed, 4) - 0.5)
  )
    .cross(direction)
    .normalize();
  return direction.clone().applyAxisAngle(across, angle).normalize();
}

/**
 * A segment and everything that grows from it: each fork splits into two
 * thinner daughters that diverge by 25 to 40 degrees, and each daughter
 * starts inside its parent's rounded end so the fork is one surface.
 */
function grow(branch: Branch): readonly Branch[] {
  if (branch.level === FORKS) {
    return [branch];
  }
  const end = branch.start
    .clone()
    .addScaledVector(branch.direction, branch.length);
  const daughters = Arr.map([-1, 1] as const, (side) => {
    const seed = branch.seed * 3 + side + 7;
    const direction = turn(
      branch.direction,
      side * (0.44 + 0.25 * hashUnit(seed, 6)),
      branch.seed
    );
    const radius = branch.radius[1] * 0.78;
    return {
      direction,
      length: branch.length * (0.7 + 0.25 * hashUnit(seed, 8)),
      level: branch.level + 1,
      radius: [
        radius,
        branch.level + 1 === FORKS ? radius * 0.55 : radius * 0.7,
      ] as const,
      seed,
      start: end.clone().addScaledVector(branch.direction, -branch.radius[1]),
    };
  });
  return [branch, ...Arr.flatMap(daughters, grow)];
}

/** The curve of one segment: straight in its direction, bowed a little either side as dendrites wander. */
function course(branch: Branch) {
  const wander = (share: number, salt: number) =>
    turn(
      branch.direction,
      0.5 * (hashUnit(branch.seed, salt) - 0.5),
      branch.seed + salt
    )
      .multiplyScalar(branch.length * share)
      .add(branch.start);
  return new CatmullRomCurve3(
    [
      branch.start,
      wander(0.34, 11),
      wander(0.68, 13),
      branch.start.clone().addScaledVector(branch.direction, branch.length),
    ],
    false,
    "centripetal"
  );
}

/**
 * The dendrites of the motor neuron: seven trunks that leave the cell body
 * through their tapered roots and fork twice, thinning at every fork and
 * rounding off at their tips, their surface swelling and narrowing a little
 * along its length as living dendrites do. The drawing ends them where the
 * card ends; real ones reach about a millimetre.
 */
export function Dendrites() {
  const geometry = useMemo(() => {
    const branches = Arr.flatMap(TRUNKS, (trunk) => {
      const axis = new Vector3(
        trunk.direction.x,
        trunk.direction.y,
        trunk.direction.z * SOMA.depth
      ).normalize();
      return grow({
        direction: axis,
        length: trunk.length,
        level: 0,
        radius: [0.78, 0.46],
        seed: trunk.index + 1,
        start: SOMA.centre.clone().addScaledVector(axis, SOMA.radius + 0.4),
      });
    });
    const parts = Arr.map(branches, (branch) =>
      sweep({
        curve: course(branch),
        radius: (along, angle) => {
          const swell =
            1 +
            0.12 *
              (valueNoise(along * 7 + branch.seed * 3, angle * 0.6, 64) - 0.5);
          const size =
            branch.radius[0] + (branch.radius[1] - branch.radius[0]) * along;
          return rounded(
            size * swell,
            Math.min(0.3, branch.radius[1] / branch.length),
            along
          );
        },
        rings: branch.level === 0 ? 30 : 22,
        sides: branch.level === FORKS ? 8 : 12,
      })
    );
    const merged = mergeGeometries([...parts]);
    Arr.forEach(parts, (part) => part.dispose());
    return merged;
  }, []);
  useOwned(geometry);

  return (
    <mesh castShadow geometry={geometry} receiveShadow>
      <TissueMaterial color={NEURON_COLORS.neurite} />
    </mesh>
  );
}
