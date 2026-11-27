import { RoundedBox } from "@react-three/drei";
import {
  jacketOf,
  LANTERN,
  LANTERN_POSTS,
} from "@repo/design-system/components/three/apparatus/lantern";
import { PrintFace } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import { useMemo } from "react";

/** The colours its jacket is printed in. */
const JACKET_INKS = {
  ground: LABWARE_COLORS.jacket,
  ink: LABWARE_COLORS.enamel,
};

/**
 * A 6 V lantern battery standing on the bench at y = 0, its printed jacket
 * facing +z: a square block in a paper jacket under a black moulded top,
 * with a red positive and a black negative 4 mm terminal on the top
 * (`LANTERN_POSTS`, positive first).
 *
 * @example
 * <LanternBattery volts={6} />
 *
 * @param volts - Its voltage, printed on its jacket
 */
export function LanternBattery({ volts }: { readonly volts: number }) {
  const format = usePrintNumber();
  const jacket = useMemo(
    () => jacketOf(volts, JACKET_INKS, format),
    [format, volts]
  );

  return (
    <group>
      <RoundedBox
        args={[LANTERN.width, LANTERN.height, LANTERN.width]}
        castShadow
        position={[0, LANTERN.height / 2, 0]}
        radius={0.004}
        receiveShadow
        smoothness={4}
      >
        <SurfaceMaterial
          bump={0.3}
          coat={0.2}
          color={LABWARE_COLORS.jacket}
          repeat={[2, 3]}
          roughness={0.6}
          surface="paint"
        />
      </RoundedBox>
      <group position={[0, LANTERN.height / 2, LANTERN.width / 2 + 0.0004]}>
        <PrintFace sheet={jacket} stock="ink" />
      </group>
      <RoundedBox
        args={[LANTERN.width + 0.001, LANTERN.cap, LANTERN.width + 0.001]}
        castShadow
        position={[0, LANTERN.height + LANTERN.cap / 2, 0]}
        radius={0.002}
        smoothness={3}
      >
        <SurfaceMaterial
          coat={0.3}
          color={LABWARE_COLORS.jacketTop}
          roughness={0.45}
          surface="plastic"
        />
      </RoundedBox>
      <Terminal color={LABWARE_COLORS.leadRed} position={LANTERN_POSTS[0]} />
      <Terminal color={LABWARE_COLORS.leadBlack} position={LANTERN_POSTS[1]} />
    </group>
  );
}

/** A 4 mm socket terminal on the battery's top: a moulded collar in its colour about a nickel socket. */
function Terminal({
  color,
  position,
}: {
  readonly color: string;
  readonly position: readonly [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, -LANTERN.stud / 2, 0]}>
        <cylinderGeometry args={[0.0068, 0.0082, LANTERN.stud, 28]} />
        <SurfaceMaterial
          coat={0.4}
          color={color}
          repeat={[2, 1]}
          roughness={0.5}
          surface="plastic"
        />
      </mesh>
      <mesh position={[0, -0.0004, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.0012, 20]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.nickel}
          metalness={1}
          roughness={0.26}
          surface="brushed"
        />
      </mesh>
    </group>
  );
}
