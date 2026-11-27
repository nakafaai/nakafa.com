import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { Strake } from "@repo/design-system/components/three/vessel/strake";
import { RINK_COLORS } from "@repo/design-system/lib/material/rink";
import { Vector2 } from "three";

/**
 * A curling stone at real size, in metres: 0.29 m across and 0.114 m tall,
 * with the eye of its handle 0.165 m over the ice.
 */
export const STONE = { eye: 0.165, radius: 0.145 } as const;

/**
 * The stone's outline from the middle of its hollow base to its crown, as
 * radius and height: it rides on a narrow running band, swells to the
 * striking band at its middle, and closes over a flat crown.
 */
const BODY = [
  new Vector2(0, 0.012),
  new Vector2(0.05, 0.012),
  new Vector2(0.059, 0.005),
  new Vector2(0.066, 0),
  new Vector2(0.073, 0.005),
  new Vector2(0.094, 0.011),
  new Vector2(0.118, 0.022),
  new Vector2(0.134, 0.037),
  new Vector2(0.143, 0.05),
  new Vector2(0.145, 0.057),
  new Vector2(0.143, 0.064),
  new Vector2(0.134, 0.077),
  new Vector2(0.118, 0.092),
  new Vector2(0.094, 0.103),
  new Vector2(0.06, 0.11),
  new Vector2(0.03, 0.113),
  new Vector2(0, 0.114),
];

/** The handle's plate, as radius and height over the crown. */
const PLATE = [
  new Vector2(0, 0.113),
  new Vector2(0.082, 0.113),
  new Vector2(0.088, 0.117),
  new Vector2(0.086, 0.123),
  new Vector2(0.06, 0.127),
  new Vector2(0, 0.128),
];

/** The gooseneck of the handle: up from the plate, then out over the stone. */
const NECK = [
  [-0.045, 0.125, 0],
  [-0.047, 0.15, 0],
  [-0.035, 0.163, 0],
  [0.0, STONE.eye, 0],
  [0.06, STONE.eye, 0],
  [0.085, 0.163, 0],
] as const;

/**
 * A curling stone: a body of polished speckled granite turned to its true
 * outline, riding on its narrow running band, with a moulded handle on a
 * plate bolted through its crown. Its handle points along +x.
 */
export function CurlingStone() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[BODY, 64]} />
        <SurfaceMaterial
          coat={0.9}
          color={RINK_COLORS.granite}
          repeat={[5, 1.4]}
          roughness={0.32}
          surface="stone"
        />
      </mesh>
      <mesh castShadow>
        <latheGeometry args={[PLATE, 48]} />
        <SurfaceMaterial
          coat={0.6}
          color={RINK_COLORS.handle}
          repeat={[2, 2]}
          roughness={0.38}
          surface="plastic"
        />
      </mesh>
      <Strake
        color={RINK_COLORS.handle}
        points={NECK}
        radius={0.013}
        surface="plastic"
      />
      <mesh castShadow position={[0, 0.131, 0]}>
        <cylinderGeometry args={[0.011, 0.011, 0.008, 6]} />
        <SurfaceMaterial
          color={RINK_COLORS.bolt}
          metalness={0.9}
          repeat={[1, 1]}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>
    </group>
  );
}
