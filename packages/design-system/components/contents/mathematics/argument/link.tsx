import { useFrame } from "@react-three/fiber";
import type { Joint } from "@repo/design-system/components/contents/mathematics/argument/form";
import {
  COLUMNS,
  LINK_GAP,
  RAIL,
} from "@repo/design-system/components/contents/mathematics/argument/layout";
import { ARGUMENT_COLORS } from "@repo/design-system/lib/material/argument";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";
import { MathUtils } from "three";

/** One oval link: its outer length and width, and how thick its wire is, in metres. */
const RING = { length: 0.018, tube: 0.0021, width: 0.013 } as const;

/**
 * How far each link swings from the line of the chain, in radians: a little
 * while the chain waits, so the two links lie apart; none once locked, so
 * they overlap as one chain; and far once broken, so the gap between them
 * shows from across the room.
 */
const SWING = { broken: 0.62, locked: 0, pending: 0.2 } as const;

/** How quickly a link swings to its place, as a damping rate a second. */
const SWING_RATE = 12;

/** Each state's finish: bright steel, polished brass, or red enamel. */
const FINISH = {
  broken: { color: ARGUMENT_COLORS.broken, metalness: 0.15, roughness: 0.4 },
  locked: { color: ARGUMENT_COLORS.locked, metalness: 0.85, roughness: 0.28 },
  pending: { color: ARGUMENT_COLORS.steel, metalness: 0.8, roughness: 0.34 },
} as const;

/**
 * The pair of links that joins one pocket of the rail to the next, lying
 * flat in the gap between them: the upper link hangs from the pocket above,
 * the lower one from the plate below. Locked, the two lie straight and
 * overlap as a chain does, in brass; broken, they swing apart in red, the
 * way a chain that has snapped hangs; waiting, they lie a little apart in
 * steel.
 */
export function ChainLink({
  joint,
  z,
}: {
  readonly joint: Joint;
  readonly z: number;
}) {
  const swing = useRef<Group[]>([]);
  const finish = FINISH[joint];

  useFrame((state, delta) => {
    const target = SWING[joint];
    Arr.forEach(swing.current, (link) => {
      const next = MathUtils.damp(
        link.rotation.y,
        target,
        SWING_RATE,
        Math.min(delta, 0.1)
      );
      link.rotation.y = Math.abs(next - target) < 0.0005 ? target : next;
      if (link.rotation.y !== target) {
        state.invalidate();
      }
    });
  });

  return (
    <group>
      {Arr.map([-1, 1] as const, (side, index) => (
        <group
          key={side}
          position={[COLUMNS.rail, RAIL.top, z + (side * LINK_GAP) / 2]}
          ref={(link) => {
            if (link !== null) {
              swing.current[index] = link;
            }
          }}
          rotation={[0, SWING.pending, 0]}
        >
          <mesh
            castShadow
            position={[
              0,
              RING.tube * (side === 1 ? 2.1 : 1),
              (-side * RING.length) / 2,
            ]}
            rotation={[Math.PI / 2 + side * 0.12, 0, 0]}
            scale={[
              1,
              (RING.length / 2 - RING.tube) / (RING.width / 2 - RING.tube),
              1,
            ]}
          >
            <torusGeometry
              args={[RING.width / 2 - RING.tube, RING.tube, 12, 40]}
            />
            <meshStandardMaterial
              color={finish.color}
              metalness={finish.metalness}
              roughness={finish.roughness}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
