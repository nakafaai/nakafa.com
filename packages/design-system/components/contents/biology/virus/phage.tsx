import { Instances } from "@repo/design-system/components/contents/biology/instances";
import {
  capsomeres,
  tailFibre,
} from "@repo/design-system/components/contents/biology/virus/capsid";
import { useFacetedShell } from "@repo/design-system/components/contents/biology/virus/parts";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";

/**
 * Phage T4 at 1 unit to 200 nm: a prolate icosahedral head 120 nm long and
 * 86 nm wide on its five-fold axis, a tail about 100 nm long, and six long
 * tail fibres about 145 nm long.
 */
const HEAD = { centre: 0.27, extra: 0.395, radius: 0.215 } as const;

/** The 24 rings of the contractile sheath, about 4 nm each. */
const RINGS = 24;

/** The six long tail fibres, each a smooth curve through its knee. */
const FIBRES = Arr.map(Arr.range(0, 5), (index) => ({
  curve: new CatmullRomCurve3(
    Arr.map(tailFibre(index, 6), (point) => new Vector3(...point))
  ),
  index,
}));

/**
 * The tail of a T4 phage from the collar down, extended before it lands or
 * contracted once it has: the sheath shortens to half its length and
 * widens, and the rigid core tube inside is driven through the cell wall.
 */
function tailShape(landed: boolean) {
  const top = -0.06;
  const length = landed ? 0.22 : 0.44;
  return {
    base: top - length - 0.015,
    gap: length / RINGS,
    ring: landed ? 0.075 : 0.058,
    top,
    tube: landed ? 0.14 : 0,
  };
}

/**
 * Phage T4: a faceted, prolate head tiled with capsomeres, a collar, a
 * striated contractile sheath round a hollow core tube, a hexagonal
 * baseplate with short pins, and six kinked long tail fibres. `landed`
 * shows it on a cell, its sheath contracted and its tube pushed through the
 * wall to inject its DNA.
 */
export function BacteriophageModel({
  landed = false,
  scale = 1,
}: {
  landed?: boolean;
  scale?: number;
}) {
  const shell = useFacetedShell(HEAD.extra);
  const tail = tailShape(landed);
  const tiles = useMemo(
    () =>
      Arr.map(capsomeres(4, HEAD.extra), ({ normal, position }, index) => ({
        position: [
          position[0] * HEAD.radius,
          position[1] * HEAD.radius + HEAD.centre,
          position[2] * HEAD.radius,
        ] as const,
        spin: index * 0.41,
        up: normal,
      })),
    []
  );
  const rings = useMemo(
    () =>
      Arr.map(Arr.range(0, RINGS - 1), (index) => ({
        position: [0, tail.top - (index + 0.5) * tail.gap, 0] as const,
        rotation: [0, index * 0.26, 0] as const,
      })),
    [tail.gap, tail.top]
  );
  return (
    <group scale={scale}>
      <mesh
        castShadow
        geometry={shell}
        position={[0, HEAD.centre, 0]}
        receiveShadow
        scale={HEAD.radius * 0.97}
      >
        <meshPhysicalMaterial
          clearcoat={0.5}
          clearcoatRoughness={0.35}
          color={MATERIAL.phageHead}
          roughness={0.5}
        />
      </mesh>
      <Instances placements={tiles}>
        <cylinderGeometry args={[0.025, 0.028, 0.008, 6]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={MATERIAL.phageHead}
          roughness={0.5}
        />
      </Instances>
      <mesh castShadow position={[0, -0.045, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.03, 18]} />
        <meshStandardMaterial color={MATERIAL.phageSheath} roughness={0.55} />
      </mesh>
      <Instances placements={rings}>
        <cylinderGeometry args={[tail.ring, tail.ring, tail.gap * 0.86, 18]} />
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={MATERIAL.phageSheath}
          roughness={0.5}
        />
      </Instances>
      <mesh position={[0, (tail.top + tail.base - tail.tube) / 2, 0]}>
        <cylinderGeometry
          args={[0.021, 0.021, tail.top - tail.base + tail.tube, 14]}
        />
        <meshStandardMaterial color={MATERIAL.baseplate} roughness={0.5} />
      </mesh>
      <group position={[0, tail.base, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.09, 0.03, 6]} />
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={MATERIAL.baseplate}
            roughness={0.5}
          />
        </mesh>
        <Instances
          placements={Arr.map(Arr.range(0, 5), (index) => {
            const angle = (index / 6) * Math.PI * 2;
            return {
              position: [
                Math.cos(angle) * 0.075,
                -0.035,
                Math.sin(angle) * 0.075,
              ] as const,
              rotation: [Math.PI, 0, 0] as const,
            };
          })}
        >
          <coneGeometry args={[0.012, 0.045, 6]} />
          <meshStandardMaterial color={MATERIAL.baseplate} roughness={0.5} />
        </Instances>
        {Arr.map(FIBRES, ({ curve, index }) => (
          <mesh castShadow key={index}>
            <tubeGeometry args={[curve, 48, 0.0065, 6, false]} />
            <meshStandardMaterial color={MATERIAL.tailFibre} roughness={0.55} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
