import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";

/** The needle sweeps three quarters of a turn, from lower left round to lower right. */
const SWEEP = { from: Math.PI * 1.25, turn: Math.PI * 1.5 } as const;

/** Ten major divisions, each split in five, as a Bourdon gauge's scale is. */
const MAJOR = 10;
const MINOR = 5;

/** How many of the last major divisions are printed red, as the limit zone. */
const LIMIT = 2;

/** The angle of a place on the scale, from 0 at its start to 1 at its end. */
function scaleAngle(place: number) {
  return SWEEP.from - SWEEP.turn * Math.min(1, Math.max(0, place));
}

/**
 * A Bourdon dial gauge facing +z, its centre at the origin: a polished brass
 * case and bezel, a white enamel face printed with a scale of ticks whose
 * last divisions are red, a red needle on its hub, and a glass cover. The
 * ticks are geometry, so the scale stays sharp however close the camera
 * comes. `reading` sets the needle.
 *
 * @param radius - The radius of the dial's face
 * @param reading - Where the needle rests, from 0 to 1 of the scale
 */
export function DialGauge({
  radius,
  reading,
}: {
  readonly radius: number;
  readonly reading: number;
}) {
  const depth = radius * 0.42;

  return (
    <group>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 1.06, radius, depth, 48]} />
        <meshStandardMaterial
          color={INSTRUMENT_COLORS.brass}
          metalness={1}
          roughness={0.28}
        />
      </mesh>
      <mesh castShadow position={[0, 0, depth / 2]}>
        <torusGeometry args={[radius * 1.02, radius * 0.075, 16, 64]} />
        <meshStandardMaterial
          color={INSTRUMENT_COLORS.brass}
          metalness={1}
          roughness={0.16}
        />
      </mesh>
      <mesh position={[0, 0, depth / 2 + 0.0005]}>
        <circleGeometry args={[radius * 0.97, 64]} />
        <meshStandardMaterial
          color={INSTRUMENT_COLORS.dialFace}
          roughness={0.55}
        />
      </mesh>
      {Arr.map(Arr.range(0, MAJOR * MINOR), (index) => {
        const major = index % MINOR === 0;
        const angle = scaleAngle(index / (MAJOR * MINOR));
        const long = radius * (major ? 0.16 : 0.08);
        const reach = radius * 0.86 - long / 2;
        return (
          <mesh
            key={index}
            position={[
              Math.cos(angle) * reach,
              Math.sin(angle) * reach,
              depth / 2 + 0.001,
            ]}
            rotation={[0, 0, angle]}
          >
            <planeGeometry args={[long, radius * (major ? 0.028 : 0.014)]} />
            <meshBasicMaterial
              color={
                index >= (MAJOR - LIMIT) * MINOR
                  ? INSTRUMENT_COLORS.dialNeedle
                  : QUANTUM_COLORS.dialInk
              }
            />
          </mesh>
        );
      })}
      <group
        position={[0, 0, depth / 2 + radius * 0.03]}
        rotation={[0, 0, scaleAngle(reading)]}
      >
        <mesh position={[radius * 0.3, 0, 0]}>
          <boxGeometry args={[radius * 0.92, radius * 0.035, radius * 0.012]} />
          <meshStandardMaterial
            color={INSTRUMENT_COLORS.dialNeedle}
            roughness={0.4}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry
            args={[radius * 0.085, radius * 0.085, radius * 0.05, 24]}
          />
          <meshStandardMaterial
            color={INSTRUMENT_COLORS.brass}
            metalness={1}
            roughness={0.25}
          />
        </mesh>
      </group>
      <mesh position={[0, 0, depth / 2 + radius * 0.07]}>
        <circleGeometry args={[radius * 0.97, 48]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.03}
          color={INSTRUMENT_COLORS.dialFace}
          depthWrite={false}
          opacity={0.12}
          roughness={0.04}
          transparent
        />
      </mesh>
    </group>
  );
}
