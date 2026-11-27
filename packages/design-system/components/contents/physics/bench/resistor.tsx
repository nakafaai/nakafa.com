import { Matter } from "@repo/design-system/components/three/matter/material";
import { Shine } from "@repo/design-system/components/three/matter/shine";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

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
          <Matter of="nickel" />
        </mesh>
      ))}
      <group position={[0, RESISTOR_HEIGHT, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.008, 0.008, span, 10]} />
          <Matter of="solder" />
        </mesh>
        <mesh castShadow>
          <capsuleGeometry args={[0.044, 0.17, 8, 24]} />
          <Matter color={QUANTUM_COLORS.resistorBody} of="epoxy" />
        </mesh>
        {Arr.map(BANDS, (band) => (
          <mesh key={band.x} position={[0, -band.x, 0]}>
            <cylinderGeometry args={[0.0452, 0.0452, 0.02, 24]} />
            <Matter color={band.color} of="epoxy" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * A helical coil of resistance wire along x, `length` long, wound in `turns`
 * of `radius` from wire `gauge` thick. It glows with `glow` from 0 (cold) to
 * 1 (orange heat) and lights what stands around it.
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

  return (
    <mesh castShadow geometry={helix}>
      <Matter glow={lit} of="nichrome" />
      <Shine glow={lit} of="nichrome" />
    </mesh>
  );
}
