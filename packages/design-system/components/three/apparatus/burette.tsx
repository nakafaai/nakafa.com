import { RoundedBox } from "@react-three/drei";
import {
  BURETTE,
  columnOf,
  scaleOf,
  stripeOf,
} from "@repo/design-system/components/three/apparatus/tube";
import {
  Borosilicate,
  Liquid,
} from "@repo/design-system/components/three/apparatus/vessel";
import { Sweep } from "@repo/design-system/components/three/form/part";
import { PrintSleeve } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import { useMemo } from "react";

/** The tube from above its stopcock to its open top, the shoulder that narrows it, and the drawn-out tip. */
const TUBE = [
  [0, BURETTE.stopcock + 0.016, 0],
  [0, BURETTE.top, 0],
] as const;
const SHOULDER = [
  [0, BURETTE.stopcock + 0.016, 0],
  [0, BURETTE.stopcock + 0.005, 0],
] as const;
const TIP = [
  [0, BURETTE.stopcock - 0.005, 0],
  [0, 0, 0],
] as const;

/** The Schellbach stripe, printed once for every burette. */
const STRIPE = stripeOf(LABWARE_COLORS.enamel, LABWARE_COLORS.enamelBlue);

/**
 * A 50 mL burette as ISO 385 makes it, its tip's end at y = 0 and its scale
 * facing +z: a borosilicate tube with its scale fired in blue enamel, 0 at
 * the top, the white Schellbach stripe with its blue centre line down its
 * back, a glass stopcock barrel with a PTFE key and its paddle, and a
 * drawn-out tip. The titrant stands from the stopcock to the meniscus at
 * the `reading`, so the scale reads what has run out.
 *
 * @example
 * <Burette holds={{ color: dichromate, strength: 90 }} reading={23.45} />
 *
 * @param holds - The titrant: its colour, and how strongly it absorbs light for each metre of it
 * @param reading - What the burette reads, in millilitres run out from its zero mark
 */
export function Burette({
  holds,
  reading,
}: {
  readonly holds: { readonly color: string; readonly strength?: number };
  readonly reading: number;
}) {
  const format = usePrintNumber();
  const scale = useMemo(
    () => scaleOf(LABWARE_COLORS.enamelBlue, format),
    [format]
  );
  const column = useMemo(() => columnOf(reading), [reading]);

  return (
    <group>
      <group
        position={[0, (BURETTE.top + BURETTE.full) / 2, 0]}
        rotation={[0, Math.PI, 0]}
      >
        <PrintSleeve radius={BURETTE.radius} sheet={STRIPE} stock="enamel" />
      </group>
      <Liquid
        color={holds.color}
        outline={column}
        width={BURETTE.bore * 2}
        {...(holds.strength === undefined ? {} : { strength: holds.strength })}
      />
      <mesh castShadow renderOrder={2}>
        <Sweep ends="open" path={TUBE} radius={BURETTE.radius} />
        <Borosilicate />
      </mesh>
      <mesh position={[0, BURETTE.top, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BURETTE.radius, 0.0009, 10, 40]} />
        <Borosilicate />
      </mesh>
      <mesh renderOrder={2}>
        <Sweep
          ends="open"
          path={SHOULDER}
          radius={[
            [0, BURETTE.radius],
            [1, 0.0042],
          ]}
        />
        <Borosilicate />
      </mesh>
      <mesh castShadow renderOrder={2}>
        <Sweep
          ends="open"
          path={TIP}
          radius={[
            [0, 0.0042],
            [0.55, 0.0032],
            [1, 0.0013],
          ]}
        />
        <Borosilicate />
      </mesh>
      <group position={[0, scale.middle, 0]}>
        <PrintSleeve
          radius={BURETTE.radius}
          sheet={scale.sheet}
          stock="enamel"
        />
      </group>
      <group position={[0, BURETTE.stopcock, 0]}>
        <mesh renderOrder={2} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0064, 0.0056, 0.019, 28, 1, true]} />
          <Borosilicate />
        </mesh>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0047, 0.0039, 0.034, 28]} />
          <SurfaceMaterial
            coat={0.3}
            color={LABWARE_COLORS.ptfe}
            roughness={0.5}
            surface="plastic"
          />
        </mesh>
        <RoundedBox
          args={[0.0048, 0.024, 0.011]}
          castShadow
          position={[0.0185, 0, 0]}
          radius={0.0018}
          smoothness={3}
        >
          <SurfaceMaterial
            coat={0.3}
            color={LABWARE_COLORS.ptfe}
            roughness={0.5}
            surface="plastic"
          />
        </RoundedBox>
        <mesh position={[-0.0185, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0058, 0.0058, 0.005, 28]} />
          <SurfaceMaterial
            color={LABWARE_COLORS.ptfe}
            repeat={[5, 1]}
            roughness={0.6}
            surface="knurl"
          />
        </mesh>
      </group>
    </group>
  );
}
