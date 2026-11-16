import { RoundedBox } from "@react-three/drei";
import {
  visibleColor,
  wavelength,
} from "@repo/design-system/components/contents/chemistry/emission/spectrum";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  MetalMaterial,
  VesselGlassMaterial,
} from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr, Option } from "effect";
import { useMemo } from "react";
import { Color, Vector2 } from "three";

/** The part of the spectrum a hand spectroscope's scale shows, in nanometres. */
const SCALE = { end: 700, start: 400 } as const;

/** How wide the spectroscope's field is, in scene units. */
const FIELD = 9;

/** How tall the field's lines stand. */
const LINE = 0.9;

/** The upper levels whose falls to n = 2 light hydrogen's visible lines, the Balmer series. */
const BALMER = [3, 4, 5, 6] as const;

/** Where a wavelength falls across the field. */
function across(nanometres: number) {
  return ((nanometres - SCALE.start) / (SCALE.end - SCALE.start) - 0.5) * FIELD;
}

/** The color of a visible line, bright enough for the finish's bloom to catch. */
function lineColor(nanometres: number, glow: number) {
  return Option.match(visibleColor(nanometres), {
    onNone: () => new Color(getColor("SLATE", 400)),
    onSome: ([red, green, blue]) =>
      new Color(red, green, blue).multiplyScalar(glow),
  });
}

/**
 * What a hand spectroscope shows when it looks at a hydrogen discharge tube:
 * a black field crossed by hydrogen's four visible lines, red at 656 nm,
 * blue-green at 486 nm and two violet lines at 434 and 410 nm, over a lit
 * nanometre scale. The line of the fall shown glows brightest and tallest.
 */
export function SpectroscopeView({
  from,
  to,
}: {
  readonly from: number;
  readonly to: number;
}) {
  const ticks = Arr.map(Arr.range(0, 6), (step) => SCALE.start + step * 50);

  return (
    <group>
      <RoundedBox
        args={[FIELD + 0.6, LINE + 1.1, 0.12]}
        position={[0, -0.2, -0.08]}
        radius={0.06}
        smoothness={3}
      >
        <meshStandardMaterial color={MATERIAL.epoxy} roughness={0.85} />
      </RoundedBox>
      {Arr.map(BALMER, (upper) => {
        const nanometres = wavelength(upper, 2);
        const current = upper === from && to === 2;
        const height = current ? LINE * 1.25 : LINE;
        return (
          <group key={upper} position={[across(nanometres), 0.1, 0]}>
            <mesh>
              <boxGeometry args={[0.035, height, 0.02]} />
              <meshBasicMaterial
                color={lineColor(nanometres, current ? 3 : 1.6)}
                toneMapped={false}
              />
            </mesh>
            <mesh position={[0, 0, -0.01]}>
              <boxGeometry args={[0.2, height * 1.05, 0.01]} />
              <meshBasicMaterial
                color={lineColor(nanometres, 1)}
                opacity={current ? 0.35 : 0.18}
                toneMapped={false}
                transparent
              />
            </mesh>
          </group>
        );
      })}
      {Arr.map(ticks, (nanometres) => (
        <group key={nanometres} position={[across(nanometres), -0.55, 0]}>
          <mesh>
            <boxGeometry args={[0.02, 0.14, 0.01]} />
            <meshBasicMaterial color={getColor("SLATE", 200)} />
          </mesh>
          <ThreeLabel
            anchorY="top"
            color={getColor("SLATE", 200)}
            fontSize="compact"
            gap={0.05}
            position={[0, -0.1, 0]}
          >
            <InlineMath math={`${nanometres}`} />
          </ThreeLabel>
        </group>
      ))}
    </group>
  );
}

/** A hydrogen spectrum tube's outline, radius first: a bulb at each end round its electrode and a thin capillary between them. */
function tubeOutline() {
  const bulb = 0.3;
  const capillary = 0.07;
  const half = 1.6;
  const neck = 1.05;
  return Arr.map(Arr.range(0, 120), (step) => {
    const y = -half + (2 * half * step) / 120;
    const along = Math.abs(y);
    if (along >= half) {
      return new Vector2(0, y);
    }
    if (along > neck) {
      const fromEnd = half - along;
      const middle = (half - neck) / 2;
      const round = Math.sqrt(
        Math.max(0, middle * middle - (middle - fromEnd) ** 2)
      );
      return new Vector2(Math.max(capillary, (round / middle) * bulb), y);
    }
    return new Vector2(capillary, y);
  });
}

/**
 * A hydrogen spectrum tube in its holder: a glass capillary between two
 * bulbs, glowing the pink of hydrogen at low pressure where the discharge
 * squeezes through it, with a nickel electrode sealed into each end and the
 * brass caps the high voltage reaches it through.
 */
export function DischargeTube() {
  const outline = useMemo(tubeOutline, []);
  const glow = new Color(MATERIAL.hydrogenGlow).multiplyScalar(2.4);

  return (
    <group>
      <mesh>
        <latheGeometry args={[outline, 48]} />
        <VesselGlassMaterial
          color={MATERIAL.glass}
          thickness={0.03}
          tint={MATERIAL.glassEdge}
        />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.045, 0.045, 2.1, 16, 1]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.12, 0.12, 2.2, 16, 1]} />
        <meshBasicMaterial
          color={glow}
          opacity={0.16}
          toneMapped={false}
          transparent
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <group key={side}>
          <mesh position={[0, side * 1.32, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.4, 8, 1]} />
            <MetalMaterial color={MATERIAL.probeSteel} roughness={0.35} />
          </mesh>
          <mesh position={[0, side * 1.72, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.22, 24, 1]} />
            <MetalMaterial color={MATERIAL.brass} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
