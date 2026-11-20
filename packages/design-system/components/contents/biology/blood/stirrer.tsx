import { useFrame } from "@react-three/fiber";
import { useRunClock } from "@repo/design-system/components/contents/biology/blood/clock";
import {
  routeAt,
  STEPS,
} from "@repo/design-system/components/contents/biology/blood/run";
import {
  CAVITY,
  columnX,
  floorAt,
  rowZ,
  TILE,
} from "@repo/design-system/components/contents/biology/blood/well";
import { SEROLOGY_COLORS } from "@repo/design-system/lib/material/serology";
import { useRef } from "react";
import type { Group, Mesh } from "three";

/** A flat polystyrene mixing stick, in metres: 80 mm long, 5 mm wide, 1 mm thick. */
const STICK = { length: 0.08, thickness: 0.001, width: 0.005 } as const;

/** How the stick in hand leans while it stirs: turned towards the right hand and tilted up, in radians. */
const HELD = { tilt: 0.95, yaw: 0.55 } as const;

/** How a stick lies on the bench: along the tile's side, its tip towards the vials. */
const LYING = { tilt: 0, yaw: -Math.PI / 2 } as const;

/** Where the stick is lifted to, out of its cavity, before it is laid down, in metres. */
const LIFTED = { aside: 0.012, height: 0.03 } as const;

/** How far a stick's tip circles from the cavity's middle while it stirs, as a share of the cavity's radius. */
const SWIRL = 0.42;

/** Moves `from` towards `to` by `share`. */
function lerp(from: number, to: number, share: number) {
  return from + (to - from) * share;
}

/**
 * The mixing stick of one cavity, its origin at the tip that stirs: each
 * cavity has its own, so no serum is carried into the next. Along its route
 * it lies beside the tile, is carried to its cavity, circles twice in it to
 * spread the blood through the serum, is lifted out, and is laid back where
 * it lay with its tip red.
 */
export function Stirrer({
  column,
  row,
}: {
  readonly column: number;
  readonly row: number;
}) {
  const clock = useRunClock();
  const stick = useRef<Group>(null);
  const stain = useRef<Mesh>(null);
  const keys = STEPS.stirrers[column];
  const restX = 0.062 + column * 0.008;
  const restZ = -0.036;
  const lieY = STICK.thickness / 2;
  const x = columnX(column);
  const z = rowZ(row);
  useFrame(() => {
    const group = stick.current;
    if (group === null) {
      return;
    }
    const along = routeAt(clock.current, keys);
    const leg = Math.min(3, Math.floor(along));
    const share = along - leg;
    const hop = Math.sin(Math.PI * share) * 0.02;
    const stir = Math.min(1, Math.max(0, along - 1));
    const swirl = stir * Math.PI * 4;
    const reach =
      CAVITY.radius * SWIRL * Math.sin(Math.PI * Math.min(1, stir * 1.15));
    const floor = TILE.height - floorAt(reach) + 0.0006;
    if (leg === 0) {
      group.position.set(
        lerp(restX, x, share),
        lerp(lieY, floor, share) + hop,
        lerp(restZ, z, share)
      );
    } else if (leg === 1) {
      group.position.set(
        x + Math.cos(swirl) * reach,
        floor,
        z + Math.sin(swirl) * reach
      );
    } else if (leg === 2) {
      group.position.set(
        lerp(x, x + LIFTED.aside, share),
        lerp(floor, LIFTED.height, share),
        z
      );
    } else {
      group.position.set(
        lerp(x + LIFTED.aside, restX, share),
        lerp(LIFTED.height, lieY, share) + hop,
        lerp(z, restZ, share)
      );
    }
    const held = Math.min(1, along, Math.max(0, 4 - along));
    group.rotation.set(
      0,
      lerp(LYING.yaw, HELD.yaw, held),
      lerp(LYING.tilt, HELD.tilt, held)
    );
    if (stain.current) {
      stain.current.visible = along >= 1;
    }
  });
  return (
    <group ref={stick}>
      <mesh castShadow position={[STICK.length / 2, 0, 0]} receiveShadow>
        <boxGeometry args={[STICK.length, STICK.thickness, STICK.width]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={SEROLOGY_COLORS.stirrer}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0.0055, 0, 0]} ref={stain} visible={false}>
        <boxGeometry
          args={[0.011, STICK.thickness + 0.0002, STICK.width + 0.0002]}
        />
        <meshPhysicalMaterial
          clearcoat={1}
          color={SEROLOGY_COLORS.bloodDeep}
          roughness={0.25}
        />
      </mesh>
    </group>
  );
}
