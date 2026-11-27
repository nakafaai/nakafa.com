import {
  NEWTON_METER,
  newtonSheet,
  stretch,
} from "@repo/design-system/components/three/apparatus/newton";
import { Spring } from "@repo/design-system/components/three/apparatus/spring";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { PrintSleeve } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { useMemo } from "react";

const BARREL = {
  long: NEWTON_METER.long,
  radius: NEWTON_METER.radius,
} as const;
const TRAVEL = NEWTON_METER.travel;
const LEAD = NEWTON_METER.lead;
const ZERO = NEWTON_METER.zero;

/** The coils of the spring inside. */
const COIL = { radius: 0.04, turns: 18, wire: 0.005 } as const;

/**
 * A newton meter lying along +x with the eye of its hook at the origin. The
 * hook's rod runs into a clear barrel and ends in a pointer; a spring joins
 * the pointer to the far end of the barrel, where the ring is pulled. The
 * spring stretches in proportion to `force`, so the barrel draws away from
 * the hook and the pointer stands at the force on the scale printed along
 * the barrel, up to `most`.
 *
 * @param color - The colour of the pointer
 * @param force - The force on the hook, in newtons
 * @param most - The largest force the scale reads, in newtons
 */
export function NewtonMeter({
  color,
  force,
  most,
}: {
  readonly color: string;
  readonly force: number;
  readonly most: number;
}) {
  const format = usePrintNumber();
  const drawn = stretch(force, most, TRAVEL);
  const pointer = LEAD + ZERO;
  const scale = useMemo(
    () =>
      newtonSheet(
        { most, travel: TRAVEL, wide: BARREL.radius * 1.7 },
        INSTRUMENT_COLORS.graphite,
        format
      ),
    [format, most]
  );

  return (
    <group>
      <mesh castShadow position={[0.02, 0, 0]}>
        <torusGeometry args={[0.02, 0.006, 10, 26, Math.PI * 1.5]} />
        <Matter of="chrome" />
      </mesh>
      <mesh
        castShadow
        position={[(0.04 + pointer) / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.006, 0.006, pointer - 0.04, 12]} />
        <Matter of="chrome" />
      </mesh>
      <mesh position={[pointer, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry
          args={[BARREL.radius * 0.84, BARREL.radius * 0.84, 0.012, 32]}
        />
        <Matter color={color} of="plastic" />
      </mesh>
      <group position={[LEAD + drawn, 0, 0]}>
        <mesh position={[BARREL.long / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry
            args={[BARREL.radius, BARREL.radius, BARREL.long, 40, 1, true]}
          />
          <GlassMaterial color={INSTRUMENT_COLORS.paper} opacity={0.22} />
        </mesh>
        <group
          position={[ZERO - TRAVEL / 2, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <PrintSleeve radius={BARREL.radius} sheet={scale} stock="ink" />
        </group>
        <mesh
          castShadow
          position={[0.012, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry
            args={[BARREL.radius + 0.006, BARREL.radius + 0.006, 0.024, 40]}
          />
          <Matter color={APPARATUS_COLORS.caseDark} of="plastic" />
        </mesh>
        <mesh
          castShadow
          position={[BARREL.long, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry
            args={[BARREL.radius + 0.006, BARREL.radius + 0.006, 0.05, 40]}
          />
          <Matter color={APPARATUS_COLORS.caseDark} of="plastic" />
        </mesh>
        <mesh castShadow position={[BARREL.long + 0.064, 0, 0]}>
          <torusGeometry args={[0.04, 0.008, 10, 30]} />
          <Matter of="chrome" />
        </mesh>
        <group position={[BARREL.long, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <Spring coil={COIL} length={BARREL.long - ZERO + drawn} />
        </group>
      </group>
    </group>
  );
}
