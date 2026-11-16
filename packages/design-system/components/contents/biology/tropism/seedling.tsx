import {
  bend,
  growth,
  type Organ,
  type Split,
} from "@repo/design-system/components/contents/biology/tropism/auxin";
import {
  organPath,
  tipHeading,
} from "@repo/design-system/components/contents/biology/tropism/shape";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";

/** An organ's radius, in metres. */
const RADIUS = { root: 0.0022, shoot: 0.0034 } as const;

/** How long each organ starts, and how much it grows over the run, in metres. */
const LENGTH = {
  root: { grows: 0.03, start: 0.022 },
  shoot: { grows: 0.03, start: 0.032 },
} as const;

/**
 * How an organ turns in the scene: a shoot turns towards the stimulus with a
 * positive bend, which the scene draws clockwise for an upright shoot lit
 * from the right and counter clockwise for a flat shoot pointing right; a
 * root's positive bend turns it towards gravity.
 */
function sceneBend(organ: Organ, value: number) {
  return organ === "shoot" ? -value : value;
}

/** The centre line of an organ after `progress` of the run, in the scene's plane. */
function organShape(
  heading: number,
  organ: Organ,
  progress: number,
  split: Split
) {
  const turn = sceneBend(organ, bend(split, organ, progress));
  const length =
    LENGTH[organ].start + LENGTH[organ].grows * growth(split, progress);
  return {
    points: organPath({
      bend: turn,
      heading,
      length,
      samples: 40,
      straight: organ === "shoot" ? 0.45 : 0.3,
    }),
    turn,
  };
}

/**
 * One organ of a seedling, a shoot or a root, leaving the origin along
 * `heading` in the x–y plane: its curved body from the auxin `split` after
 * `progress` of the run, its tip (none when `cut`), and the auxin streaming
 * down it, more on the side that holds more.
 */
export function SeedlingOrgan({
  cut = false,
  heading,
  organ,
  progress,
  split,
}: {
  readonly cut?: boolean;
  readonly heading: number;
  readonly organ: Organ;
  readonly progress: number;
  readonly split: Split;
}) {
  const { points, turn } = organShape(heading, organ, progress, split);
  const radius = RADIUS[organ];
  const path = useMemo(
    () =>
      new CatmullRomCurve3(Arr.map(points, ([x, y]) => new Vector3(x, y, 0))),
    [points]
  );
  const tip = points[points.length - 1] ?? [0, 0];
  const end = tipHeading(heading, turn);
  const grains = Arr.flatMap([-1, 1] as const, (side) => {
    const share = side === 1 ? split.far : split.near;
    const count = Math.round(share * 8);
    return Arr.map(Arr.range(1, count), (index) => {
      const point = path.getPointAt(1 - (index / (count + 1)) * 0.9);
      const tangent = path.getTangentAt(1 - (index / (count + 1)) * 0.9);
      return {
        key: `${side}${index}`,
        position: [
          point.x -
            tangent.y *
              side *
              radius *
              0.55 *
              Math.sign(Math.cos(heading) + 0.001),
          point.y +
            tangent.x *
              side *
              radius *
              0.55 *
              Math.sign(Math.cos(heading) + 0.001),
          radius * 0.7,
        ] as const,
      };
    });
  });
  const color = organ === "shoot" ? MATERIAL.coleoptile : MATERIAL.root;

  return (
    <group>
      <mesh castShadow>
        <tubeGeometry args={[path, 48, radius, 14, false]} />
        <meshPhysicalMaterial
          color={color}
          roughness={0.5}
          sheen={0.4}
          sheenColor={MATERIAL.leafUnder}
        />
      </mesh>
      {!cut && (
        <mesh position={[tip[0], tip[1], 0]}>
          <sphereGeometry args={[radius, 16, 12]} />
          <meshPhysicalMaterial
            color={organ === "root" ? MATERIAL.rootCap : color}
            roughness={0.5}
          />
        </mesh>
      )}
      {cut && (
        <mesh
          position={[tip[0], tip[1], 0]}
          rotation={[0, 0, end - Math.PI / 2]}
        >
          <cylinderGeometry args={[radius * 1.01, radius * 1.01, 0.0006, 16]} />
          <meshStandardMaterial color={MATERIAL.cutTissue} roughness={0.7} />
        </mesh>
      )}
      {Arr.map(grains, (grain) => (
        <mesh key={grain.key} position={grain.position}>
          <sphereGeometry args={[radius * 0.28, 8, 6]} />
          <meshBasicMaterial color={MATERIAL.auxin} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Where along an organ, as a share of its length, and how far round its tip, a cap or a mica plate sits. */
export function organTip(
  heading: number,
  organ: Organ,
  progress: number,
  split: Split
) {
  const { points, turn } = organShape(heading, organ, progress, split);
  return {
    below: points[36] ?? [0, 0],
    heading: tipHeading(heading, turn),
    radius: RADIUS[organ],
    tip: points[40] ?? [0, 0],
  };
}
