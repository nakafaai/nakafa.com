import { RoundedBox } from "@react-three/drei";
import { JOURNEY_COLORS } from "@repo/design-system/lib/material/journey";
import { Array as Arr } from "effect";

/** The four wheels of the bus: across and along from its middle. */
const BUS_WHEELS = [
  [-0.0105, -0.019],
  [0.0105, -0.019],
  [-0.0105, 0.019],
  [0.0105, 0.019],
] as const;

/**
 * A model bus, its front toward -z and its wheels on y = 0: an orange body
 * with a pale roof panel, a band of tinted windows round it, a windscreen and four
 * black wheels. About 6 cm long, a toy beside the road.
 */
export function Bus() {
  return (
    <group>
      <RoundedBox
        args={[0.022, 0.02, 0.058]}
        castShadow
        position={[0, 0.0145, 0]}
        radius={0.003}
        smoothness={3}
      >
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={JOURNEY_COLORS.busPaint}
          roughness={0.35}
        />
      </RoundedBox>
      <mesh position={[0, 0.0185, 0.002]}>
        <boxGeometry args={[0.0226, 0.0068, 0.048]} />
        <meshStandardMaterial color={JOURNEY_COLORS.glass} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.0175, -0.0292]}>
        <boxGeometry args={[0.018, 0.0085, 0.0008]} />
        <meshStandardMaterial color={JOURNEY_COLORS.glass} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.0248, 0.004]}>
        <boxGeometry args={[0.012, 0.0008, 0.03]} />
        <meshStandardMaterial color={JOURNEY_COLORS.busRoof} roughness={0.5} />
      </mesh>
      {Arr.map(BUS_WHEELS, ([x, z]) => (
        <mesh
          castShadow
          key={`${x}-${z}`}
          position={[x, 0.0045, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.0045, 0.0045, 0.003, 16]} />
          <meshStandardMaterial color={JOURNEY_COLORS.tyre} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** How much larger the motorbike is drawn than true to the bus, so it still reads from above. */
const BIKE_SCALE = 1.4;

/**
 * A model motorbike and its rider, its front toward -z and its wheels on
 * y = 0: two black wheels, a teal tank under a dark seat, handlebars, and a
 * rider in a white helmet.
 */
export function Motorbike() {
  return (
    <group scale={BIKE_SCALE}>
      {Arr.map([-0.0095, 0.0095] as const, (z) => (
        <mesh
          castShadow
          key={z}
          position={[0, 0.0055, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.0055, 0.0055, 0.0024, 16]} />
          <meshStandardMaterial color={JOURNEY_COLORS.tyre} roughness={0.9} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.0105, -0.001]}>
        <boxGeometry args={[0.0062, 0.0062, 0.017]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={JOURNEY_COLORS.bikePaint}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 0.0142, 0.0045]}>
        <boxGeometry args={[0.0056, 0.002, 0.009]} />
        <meshStandardMaterial color={JOURNEY_COLORS.tyre} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.0168, -0.0085]}>
        <boxGeometry args={[0.013, 0.0012, 0.0015]} />
        <meshStandardMaterial color={JOURNEY_COLORS.pole} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 0.021, 0.002]}>
        <boxGeometry args={[0.0082, 0.011, 0.0055]} />
        <meshStandardMaterial color={JOURNEY_COLORS.rider} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.0296, 0.0005]}>
        <sphereGeometry args={[0.0039, 16, 12]} />
        <meshStandardMaterial color={JOURNEY_COLORS.helmet} roughness={0.4} />
      </mesh>
    </group>
  );
}
