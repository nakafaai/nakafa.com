import { STILT } from "@repo/design-system/components/contents/biology/climate/house";
import { GROVE } from "@repo/design-system/components/contents/biology/climate/palms";
import {
  houseSpot,
  VILLAGE,
} from "@repo/design-system/components/contents/biology/climate/sea";
import { landAt } from "@repo/design-system/components/contents/biology/climate/shore";
import {
  Instances,
  type Placement,
} from "@repo/design-system/components/contents/biology/instances";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Where each house stands, so no plant grows into one. */
const HOUSES = Arr.map(VILLAGE.floors, (floor, index) =>
  houseSpot(index, floor - STILT)
);

/**
 * Banana plants in the kampung's yards behind the beach, each `[x, z,
 * size]` in metres, kept clear of every house, its steps and veranda, and
 * of the palms.
 */
const STOOLS = Arr.take(
  Arr.filter(
    Arr.map(Arr.range(0, 79), (plant) => {
      const x = 19 + hashUnit(plant, 11) * 36;
      const z = (hashUnit(plant, 12) - 0.5) * 70;
      return [x, z, 0.75 + hashUnit(plant, 13) * 0.5] as const;
    }),
    ([x, z]) =>
      Arr.every(
        HOUSES,
        ([houseX, , houseZ]) =>
          Math.abs(x - houseX) > 6.5 || Math.abs(z - houseZ) > 7
      ) &&
      Arr.every(
        GROVE,
        ([palmX, palmZ]) => Math.hypot(x - palmX, z - palmZ) > 3.5
      )
  ),
  16
);

/** How tall the pseudostem stands before its leaves spread, in metres. */
const STEM = 2;

/**
 * One leaf: a bare stalk, then a long blade along a midrib that rises from
 * the stem top and arches over, its two halves folded down a little from
 * the rib and split here and there by the wind, as banana leaves tear.
 */
function leaf(heading: number, rise: number, length: number, seed: number) {
  const out = new Vector3(Math.cos(heading), 0, Math.sin(heading));
  const side = new Vector3(-out.z, 0, out.x);
  const steps = 18;
  const sag = 0.75 - rise * 0.35;
  const rib = Arr.map(Arr.range(0, steps), (step) => {
    const s = (step / steps) * length;
    return new Vector3(0, STEM - 0.1, 0)
      .addScaledVector(out, s * Math.cos(rise) + 0.1)
      .add(
        new Vector3(0, s * Math.sin(rise) - sag * length * (s / length) ** 2, 0)
      );
  });
  const width = (t: number) => {
    const blade = Math.max(0, (t - 0.18) / 0.82);
    return 0.3 * Math.sin(Math.PI * Math.min(1, blade * 1.04)) ** 0.5;
  };
  const edge = (point: Vector3, t: number, hand: number) =>
    point
      .clone()
      .addScaledVector(side, hand * width(t))
      .add(new Vector3(0, -0.15 * width(t), 0));
  const corners = Arr.flatMap(Arr.range(0, steps - 1), (step) => {
    const a = rib[step] ?? new Vector3();
    const b = rib[step + 1] ?? new Vector3();
    const ta = step / steps;
    const tb = (step + 1) / steps;
    return Arr.flatMap([1, -1], (hand) =>
      hashUnit(step * 2 + hand, seed) < 0.28
        ? []
        : [a, edge(a, ta, hand), b, b, edge(a, ta, hand), edge(b, tb, hand)]
    );
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array(
        Arr.flatMap(corners, (point) => [point.x, point.y, point.z])
      ),
      3
    )
  );
  geometry.setAttribute(
    "uv",
    new BufferAttribute(new Float32Array(corners.length * 2), 2)
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** A banana plant's crown of seven leaves, the young ones upright and the old ones spread wide. */
function crown() {
  return mergeGeometries(
    Arr.map(Arr.range(0, 6), (index) =>
      leaf(
        index * 2.4 + hashUnit(index, 3) * 0.4,
        1.25 - index * 0.16,
        2.5 + hashUnit(index, 4) * 0.6,
        index + 17
      )
    )
  );
}

/** Banana plants growing in the yards, the kampung's commonest garden crop. */
export function Bananas() {
  const parts = useMemo(
    () => ({
      leaves: crown(),
      stem: new CylinderGeometry(0.13, 0.2, STEM + 0.4, 10).translate(
        0,
        STEM / 2 - 0.2,
        0
      ),
    }),
    []
  );
  useEffect(
    () => () => {
      parts.leaves.dispose();
      parts.stem.dispose();
    },
    [parts]
  );
  const placements: readonly Placement[] = Arr.map(
    STOOLS,
    ([x, z, size], plant) => ({
      position: [x, landAt(x, z), z],
      rotation: [0, hashUnit(plant, 14) * Math.PI * 2, 0],
      scale: [size, size, size],
    })
  );
  return (
    <>
      <Instances placements={placements}>
        <primitive attach="geometry" object={parts.stem} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.bananaLeaf}
          roughness={0.85}
        />
      </Instances>
      <Instances placements={placements}>
        <primitive attach="geometry" object={parts.leaves} />
        <meshStandardMaterial
          color={ROAD_COLORS.foliageLight}
          roughness={0.6}
          side={DoubleSide}
        />
      </Instances>
    </>
  );
}
