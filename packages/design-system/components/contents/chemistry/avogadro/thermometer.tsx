import { RIG_Z } from "@repo/design-system/components/contents/chemistry/avogadro/apparatus";
import type { GasCondition } from "@repo/design-system/components/contents/chemistry/avogadro/model";
import { latheProfile } from "@repo/design-system/components/contents/chemistry/glassware";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { LatheGeometry } from "three";

export const THERM_X = 0.145;

const THERM_GLASS_PROFILE = latheProfile([
  [0.001, 0],
  [0.0075, 0.002],
  [0.0108, 0.008],
  [0.0108, 0.016],
  [0.006, 0.023],
  [0.0052, 0.028],
  [0.0052, 0.215],
  [0.0042, 0.221],
  [0.001, 0.222],
]);

const THERM_TICKS = Arr.makeBy(11, (idx) => 0.112 + idx * 0.0155);

/** Calibrated laboratory glass thermometer with enamel scale plate and live temperature column. */
export function GlassThermometer({
  condition,
}: {
  readonly condition: GasCondition;
}) {
  const glassGeo = useMemo(
    () => new LatheGeometry(THERM_GLASS_PROFILE, 32),
    []
  );
  useEffect(() => () => glassGeo.dispose(), [glassGeo]);

  const isRtp = condition === "rtp";
  const fluidColor = isRtp
    ? PROCESS_COLORS.weakAcidOrange
    : PROCESS_COLORS.coldBlue;
  const columnHeight = isRtp ? 0.148 : 0.068;

  return (
    <group position={[THERM_X, 0.062, RIG_Z + 0.008]}>
      {/* White enamel graduation scale plate behind capillary */}
      <mesh castShadow position={[0, 0.125, -0.0055]}>
        <boxGeometry args={[0.022, 0.185, 0.0024]} />
        <meshStandardMaterial
          color={INSTRUMENT_COLORS.dialFace}
          roughness={0.42}
        />
      </mesh>
      {/* Crisp degree ticks */}
      {Arr.map(THERM_TICKS, (y, idx) => (
        <mesh key={y} position={[0.004, y - 0.062, -0.004]}>
          <boxGeometry args={[idx % 2 === 0 ? 0.009 : 0.005, 0.0014, 0.0008]} />
          <meshBasicMaterial color={INSTRUMENT_COLORS.graphite} />
        </mesh>
      ))}
      {/* Liquid bulb + live temperature capillary column */}
      <mesh position={[0, 0.012, 0]}>
        <sphereGeometry args={[0.0086, 18, 16]} />
        <meshStandardMaterial
          color={fluidColor}
          emissive={fluidColor}
          emissiveIntensity={0.28}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.02 + columnHeight / 2, 0]}>
        <cylinderGeometry args={[0.0022, 0.0022, columnHeight, 14]} />
        <meshStandardMaterial
          color={fluidColor}
          emissive={fluidColor}
          emissiveIntensity={0.28}
          roughness={0.2}
        />
      </mesh>
      {/* Turned borosilicate outer glass bulb and stem */}
      <mesh castShadow geometry={glassGeo} renderOrder={2}>
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.34} />
      </mesh>
    </group>
  );
}
