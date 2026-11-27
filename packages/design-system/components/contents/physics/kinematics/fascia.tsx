import { RoundedBox } from "@react-three/drei";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { Array as Arr } from "effect";
import type { Material } from "three";

/** The body's half width at the doors, where the trim sits flush, in metres. */
const FLANK = 0.9;

/** Where the door shut lines run down the flank, from the front door forward. */
const SEAMS = [0.96, -0.23, -0.9] as const;

/** The two sides of the car: left (+z) and right (−z). */
const SIDES = [1, -1] as const;

/** Unpainted black plastic, as on a grille, an air intake and the sills. */
function TrimPlastic() {
  return <meshStandardMaterial color={CAR_COLORS.grille} roughness={0.62} />;
}

/** Bright chrome, as on door handles, a grille bar and exhaust tips. */
function Chrome() {
  return (
    <meshStandardMaterial
      color={CAR_COLORS.chrome}
      metalness={1}
      roughness={0.14}
    />
  );
}

/**
 * What one flank carries: the door shut lines, the two handles and the black
 * sill.
 */
function Flank({ side }: { readonly side: 1 | -1 }) {
  return (
    <group>
      {Arr.map(SEAMS, (x) => (
        <mesh key={x} position={[x, 0.63, side * (FLANK + 0.0005)]}>
          <boxGeometry args={[0.007, 0.56, 0.003]} />
          <TrimPlastic />
        </mesh>
      ))}
      {Arr.map([0.22, -0.7], (x) => (
        <RoundedBox
          args={[0.17, 0.026, 0.022]}
          key={x}
          position={[x, 0.875, side * (FLANK + 0.006)]}
          radius={0.009}
          smoothness={3}
        >
          <Chrome />
        </RoundedBox>
      ))}
      <mesh position={[0.03, 0.3, side * 0.868]}>
        <boxGeometry args={[1.86, 0.075, 0.012]} />
        <TrimPlastic />
      </mesh>
    </group>
  );
}

/**
 * A wing mirror on its stalk at the foot of a windscreen pillar: a housing in
 * the body's paint with the glass set in its back.
 *
 * @param paint - The body's paint, which the housing shares
 * @param side - Which flank the mirror stands on
 */
export function Mirror({
  paint,
  side,
}: {
  readonly paint: Material;
  readonly side: 1 | -1;
}) {
  return (
    <group position={[0.99, 1.045, side * 0.9]}>
      <mesh position={[0, -0.02, -side * 0.05]}>
        <boxGeometry args={[0.07, 0.03, 0.12]} />
        <TrimPlastic />
      </mesh>
      <RoundedBox
        args={[0.11, 0.115, 0.2]}
        castShadow
        material={paint}
        position={[0, 0.03, side * 0.07]}
        radius={0.035}
        smoothness={3}
      />
      <mesh position={[-0.056, 0.03, side * 0.07]}>
        <boxGeometry args={[0.004, 0.085, 0.165]} />
        <meshStandardMaterial
          color={CAR_COLORS.tintedGlass}
          metalness={1}
          roughness={0.05}
        />
      </mesh>
    </group>
  );
}

/** One side's lamps: the headlight with its daytime strip, and the tail lamp. */
function Lamps({
  side,
  tail,
}: {
  readonly side: 1 | -1;
  readonly tail: Material;
}) {
  return (
    <group>
      <RoundedBox
        args={[0.24, 0.1, 0.4]}
        position={[2.2, 0.655, side * 0.56]}
        radius={0.04}
        rotation={[0, side * -0.44, 0]}
        smoothness={3}
      >
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.02}
          color={CAR_COLORS.headlightLens}
          emissive={CAR_COLORS.headlightGlow}
          emissiveIntensity={0.18}
          metalness={0.5}
          roughness={0.06}
        />
      </RoundedBox>
      <mesh
        position={[2.285, 0.585, side * 0.5]}
        rotation={[0, side * -0.3, 0]}
      >
        <boxGeometry args={[0.03, 0.014, 0.3]} />
        <meshStandardMaterial
          color={CAR_COLORS.headlightLens}
          emissive={CAR_COLORS.headlightGlow}
          emissiveIntensity={1.6}
        />
      </mesh>
      <RoundedBox
        args={[0.16, 0.13, 0.44]}
        material={tail}
        position={[-2.25, 0.86, side * 0.56]}
        radius={0.04}
        rotation={[0, side * 0.4, 0]}
        smoothness={3}
      />
    </group>
  );
}

/**
 * Everything a sedan carries on its pressed panels: the dark floor and wheel
 * wells seen through the arches, the grille and air intake, the number
 * plates, the lamps at each corner, the light bar across the boot, the
 * exhaust tips, and each flank's shut lines, handles and sill.
 *
 * @param tail - The tail lamps' material, which the car brightens to brake
 */
export function SedanTrim({ tail }: { readonly tail: Material }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[4.0, 0.5, 1.34]} />
        <TrimPlastic />
      </mesh>

      <RoundedBox
        args={[0.04, 0.15, 0.92]}
        position={[2.318, 0.53, 0]}
        radius={0.015}
        smoothness={2}
      >
        <TrimPlastic />
      </RoundedBox>
      {Arr.map([0.49, 0.53, 0.57], (height) => (
        <mesh key={height} position={[2.34, height, 0]}>
          <boxGeometry args={[0.008, 0.012, 0.84]} />
          <Chrome />
        </mesh>
      ))}
      <RoundedBox
        args={[0.04, 0.085, 1.16]}
        position={[2.295, 0.315, 0]}
        radius={0.015}
        smoothness={2}
      >
        <TrimPlastic />
      </RoundedBox>
      <mesh position={[2.338, 0.415, 0]}>
        <boxGeometry args={[0.01, 0.1, 0.48]} />
        <meshStandardMaterial color={CAR_COLORS.numberPlate} roughness={0.4} />
      </mesh>

      <mesh material={tail} position={[-2.318, 0.875, 0]}>
        <boxGeometry args={[0.02, 0.03, 0.72]} />
      </mesh>
      <mesh material={tail} position={[-1.36, 1.075, 0]}>
        <boxGeometry args={[0.03, 0.018, 0.34]} />
      </mesh>
      <mesh position={[-2.345, 0.6, 0]}>
        <boxGeometry args={[0.01, 0.11, 0.5]} />
        <meshStandardMaterial color={CAR_COLORS.numberPlate} roughness={0.4} />
      </mesh>
      <RoundedBox
        args={[0.05, 0.1, 1.2]}
        position={[-2.3, 0.31, 0]}
        radius={0.015}
        smoothness={2}
      >
        <TrimPlastic />
      </RoundedBox>

      {Arr.map(SIDES, (side) => (
        <group key={side}>
          <Flank side={side} />
          <Lamps side={side} tail={tail} />
          <mesh
            position={[-2.31, 0.285, side * 0.46]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.036, 0.036, 0.07, 20]} />
            <Chrome />
          </mesh>
        </group>
      ))}
    </group>
  );
}
