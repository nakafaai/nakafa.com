import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, Color, TubeGeometry, Vector3 } from "three";

const BANDS = [
  { color: QUANTUM_COLORS.resistorBand1, x: -0.075 },
  { color: QUANTUM_COLORS.resistorBand2, x: -0.035 },
  { color: QUANTUM_COLORS.resistorBand3, x: 0.005 },
  { color: QUANTUM_COLORS.resistorBand4, x: 0.08 },
] as const;

/** How high a resistor's axis stands above the board, on its two clips. */
const RESISTOR_HEIGHT = 0.1;

/**
 * A carbon-film resistor with four colour bands, held `span` apart between
 * two nickel spring clips on the board, its leads along x.
 */
export function Resistor({ span = 0.5 }: { readonly span?: number }) {
  return (
    <group>
      {Arr.map([-span / 2, span / 2] as const, (x) => (
        <mesh castShadow key={x} position={[x, RESISTOR_HEIGHT / 2, 0]}>
          <boxGeometry args={[0.03, RESISTOR_HEIGHT + 0.03, 0.07]} />
          <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.3} />
        </mesh>
      ))}
      <group position={[0, RESISTOR_HEIGHT, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.008, 0.008, span, 10]} />
          <MetalMaterial color={QUANTUM_COLORS.wireLead} roughness={0.25} />
        </mesh>
        <mesh castShadow>
          <capsuleGeometry args={[0.044, 0.17, 8, 24]} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            clearcoatRoughness={0.3}
            color={QUANTUM_COLORS.resistorBody}
            roughness={0.42}
          />
        </mesh>
        {Arr.map(BANDS, (band) => (
          <mesh key={band.x} position={[0, -band.x, 0]}>
            <cylinderGeometry args={[0.0452, 0.0452, 0.02, 24]} />
            <meshStandardMaterial color={band.color} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const COLD = new Color(APPARATUS_COLORS.nichrome);
const WARM = new Color(APPARATUS_COLORS.nichromeWarm);
const HOT = new Color(APPARATUS_COLORS.nichromeHot);

/** The colour of nichrome at `glow`: dull grey, then orange, then yellow. */
export function nichromeColor(glow: number) {
  const color = new Color();
  if (glow < 0.35) {
    color.copy(COLD).lerp(WARM, glow / 0.35);
  } else {
    color.copy(WARM).lerp(HOT, (glow - 0.35) / 0.65);
  }
  return `#${color.getHexString()}`;
}

/**
 * A helical coil of resistance wire along x, `length` long, wound in `turns`
 * of `radius` from wire `gauge` thick. It glows with `glow` from 0 (cold) to
 * 1 (yellow heat) and lights what stands near it.
 */
export function HeatingCoil({
  gauge = 0.012,
  glow,
  length,
  radius,
  turns,
}: {
  readonly gauge?: number;
  readonly glow: number;
  readonly length: number;
  readonly radius: number;
  readonly turns: number;
}) {
  const lit = Math.min(1, Math.max(0, glow));
  const helix = useMemo(() => {
    const steps = turns * 14;
    const points = Arr.makeBy(steps + 1, (index) => {
      const share = index / steps;
      const angle = share * turns * Math.PI * 2;
      return new Vector3(
        (share - 0.5) * length,
        Math.sin(angle) * radius,
        Math.cos(angle) * radius
      );
    });
    return new TubeGeometry(new CatmullRomCurve3(points), steps, gauge, 8);
  }, [gauge, length, radius, turns]);
  useEffect(() => () => helix.dispose(), [helix]);
  const color = nichromeColor(lit);

  return (
    <group>
      <mesh castShadow geometry={helix}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={lit * lit * 5}
          metalness={0.55}
          roughness={0.42}
        />
      </mesh>
      {lit > 0.05 ? (
        <pointLight
          color={APPARATUS_COLORS.nichromeWarm}
          distance={2.4}
          intensity={lit * lit * 1.8}
        />
      ) : null}
    </group>
  );
}
