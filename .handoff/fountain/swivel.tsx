import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { Strake } from "@repo/design-system/components/three/vessel/strake";
import { HOSE_COLORS } from "@repo/design-system/lib/material/hose";
import { Vector2 } from "three";

/** The collar set flush in the lawn around the ball, as radius and height in metres. */
const COLLAR = [
  new Vector2(0.043, 0),
  new Vector2(0.046, 0.012),
  new Vector2(0.06, 0.014),
  new Vector2(0.088, 0.01),
  new Vector2(0.094, 0.003),
  new Vector2(0.094, 0),
];

/** The jet tube's outline from the ball out to its lip, as radius and place along it, in metres. */
const TUBE = [
  new Vector2(0.016, 0.03),
  new Vector2(0.016, 0.07),
  new Vector2(0.019, 0.074),
  new Vector2(0.019, 0.092),
  new Vector2(0.013, 0.1),
  new Vector2(0.009, 0.1),
];

/** The hose lying on the lawn, from the collar's inlet away behind it. */
const HOSE = [
  [-0.14, 0.02, 0],
  [-0.3, 0.014, 0.02],
  [-0.7, 0.013, 0.22],
  [-1.2, 0.013, 0.16],
  [-1.7, 0.013, -0.2],
  [-2.3, 0.013, -0.24],
  [-3, 0.013, 0.3],
  [-4.2, 0.013, 0.5],
] as const;

/**
 * A swivel jet set flush in the lawn: a cast collar, a brass ball that
 * turns in it, and a short brass tube that throws the water, fed by a
 * garden hose. The ball's middle is at the origin, level with the lawn, so
 * the jet leaves from the same place at every tilt, and the tube points
 * along +x raised by `tilt`.
 *
 * @param tilt - How far the tube is raised from the lawn, in radians
 */
export function SwivelJet({ tilt }: { readonly tilt: number }) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[COLLAR, 40]} />
        <SurfaceMaterial
          color={HOSE_COLORS.body}
          metalness={0.6}
          repeat={[3, 1]}
          roughness={0.55}
          surface="cast"
        />
      </mesh>
      <mesh castShadow>
        <sphereGeometry args={[0.042, 40, 28]} />
        <SurfaceMaterial
          color={HOSE_COLORS.brass}
          metalness={0.95}
          repeat={[2, 2]}
          roughness={0.28}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow rotation={[0, 0, tilt - Math.PI / 2]}>
        <latheGeometry args={[TUBE, 32]} />
        <SurfaceMaterial
          color={HOSE_COLORS.brass}
          metalness={0.95}
          repeat={[2, 2]}
          roughness={0.25}
          surface="brushed"
        />
      </mesh>
      <mesh
        castShadow
        position={[-0.115, 0.02, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.02, 0.02, 0.06, 24]} />
        <SurfaceMaterial
          color={HOSE_COLORS.brass}
          metalness={0.95}
          repeat={[6, 1]}
          roughness={0.35}
          surface="knurl"
        />
      </mesh>
      <Strake
        color={HOSE_COLORS.hose}
        points={HOSE}
        radius={0.013}
        surface="rubber"
      />
    </group>
  );
}

/**
 * A marking peg driven into the lawn: a turned wooden stake with a painted
 * band at its head, standing on the origin.
 */
export function Peg() {
  return (
    <group>
      <mesh castShadow position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.012, 0.009, 0.18, 14]} />
        <SurfaceMaterial
          color={HOSE_COLORS.pegWood}
          repeat={[1, 2]}
          roughness={0.8}
          surface="wood"
        />
      </mesh>
      <mesh castShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.045, 14]} />
        <SurfaceMaterial
          color={HOSE_COLORS.pegBand}
          repeat={[1, 1]}
          roughness={0.5}
          surface="paint"
        />
      </mesh>
    </group>
  );
}
