import {
  SYRINGE,
  scaleOf,
  travelOf,
} from "@repo/design-system/components/three/apparatus/barrel";
import { Borosilicate } from "@repo/design-system/components/three/apparatus/vessel";
import { Sweep } from "@repo/design-system/components/three/form/part";
import { PrintSleeve } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import { useMemo } from "react";

/** The nozzle, the barrel and the plunger's hollow stem, each along the syringe. */
const NOZZLE = [
  [0, 0, 0],
  [0, SYRINGE.shoulder - 0.008, 0],
] as const;
const BARREL = [
  [0, SYRINGE.shoulder, 0],
  [0, SYRINGE.mouth, 0],
] as const;

/** The plunger: how long its ground head is, how long its stem, and how thick its thumb plate. */
const PLUNGER = { head: 0.014, plate: 0.004, stem: 0.158 } as const;

/** Ground glass: the frosted white of a plunger lapped to fit its barrel. */
function Ground() {
  return (
    <meshPhysicalMaterial
      color={LABWARE_COLORS.glass}
      opacity={0.82}
      roughness={0.62}
      transparent
    />
  );
}

/**
 * A 100 mL glass gas syringe standing on the end of its nozzle at y = 0,
 * its scale facing +z: a borosilicate barrel with a nozzle, a finger flange
 * round its mouth and a scale fired in enamel, and a ground glass plunger
 * with a hollow stem and a thumb plate. The plunger's face stands at the
 * mark of the gas the syringe `holds`, so the scale reads the volume. Lay
 * it level by turning the group it is in.
 *
 * @example
 * <Syringe holds={42} />
 *
 * @param holds - The gas it holds, in millilitres
 */
export function Syringe({ holds }: { readonly holds: number }) {
  const format = usePrintNumber();
  const scale = useMemo(
    () => scaleOf(LABWARE_COLORS.enamelBlue, format),
    [format]
  );
  const face = SYRINGE.zero + travelOf(holds);

  return (
    <group>
      <mesh castShadow renderOrder={2}>
        <Sweep ends="open" path={NOZZLE} radius={SYRINGE.nozzle} />
        <Borosilicate />
      </mesh>
      <mesh
        position={[0, SYRINGE.shoulder - 0.004, 0]}
        renderOrder={2}
        rotation={[Math.PI, 0, 0]}
      >
        <cylinderGeometry
          args={[SYRINGE.nozzle, SYRINGE.radius, 0.008, 48, 1, true]}
        />
        <Borosilicate />
      </mesh>
      <mesh castShadow renderOrder={2}>
        <Sweep ends="open" path={BARREL} radius={SYRINGE.radius} />
        <Borosilicate />
      </mesh>
      <mesh position={[0, SYRINGE.mouth, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[SYRINGE.radius + 0.003, 0.0026, 12, 48]} />
        <Borosilicate />
      </mesh>
      <group position={[0, scale.middle, 0]}>
        <PrintSleeve
          radius={SYRINGE.radius}
          sheet={scale.sheet}
          stock="enamel"
        />
      </group>
      <group position={[0, face, 0]}>
        <mesh castShadow position={[0, PLUNGER.head / 2, 0]}>
          <cylinderGeometry
            args={[
              SYRINGE.bore - 0.0003,
              SYRINGE.bore - 0.0003,
              PLUNGER.head,
              48,
            ]}
          />
          <Ground />
        </mesh>
        <mesh
          castShadow
          position={[0, PLUNGER.head + PLUNGER.stem / 2, 0]}
          renderOrder={1}
        >
          <cylinderGeometry
            args={[
              SYRINGE.bore - 0.0016,
              SYRINGE.bore - 0.0016,
              PLUNGER.stem,
              48,
              1,
              true,
            ]}
          />
          <Ground />
        </mesh>
        <mesh
          castShadow
          position={[0, PLUNGER.head + PLUNGER.stem + PLUNGER.plate / 2, 0]}
        >
          <cylinderGeometry
            args={[
              SYRINGE.radius + 0.004,
              SYRINGE.radius + 0.004,
              PLUNGER.plate,
              48,
            ]}
          />
          <Ground />
        </mesh>
      </group>
    </group>
  );
}
