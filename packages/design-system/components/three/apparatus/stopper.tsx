import {
  bungOf,
  DELIVERY,
  deliveryOf,
} from "@repo/design-system/components/three/apparatus/bung";
import { Borosilicate } from "@repo/design-system/components/three/apparatus/vessel";
import { Sweep, Turn } from "@repo/design-system/components/three/form/part";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import { useMemo } from "react";

/** The dull red-brown rubber of a bung and of a sleeve. */
function Rubber() {
  return (
    <SurfaceMaterial
      bump={0.6}
      color={LABWARE_COLORS.rubberRed}
      repeat={[3, 1]}
      roughness={0.86}
      surface="rubber"
    />
  );
}

/**
 * A rubber bung seated in a neck of the given `bore`, the rim of the neck
 * at y = 0, bored for a delivery tube.
 *
 * @example
 * <Bung bore={boreAt(flask, glassOf(flask).height)} />
 *
 * @param bore - The inner radius of the neck at its rim, in metres
 */
export function Bung({ bore }: { readonly bore: number }) {
  const outline = useMemo(() => bungOf(bore), [bore]);
  return (
    <mesh castShadow>
      <Turn profile={outline} />
      <Rubber />
    </mesh>
  );
}

/**
 * A glass delivery tube through a bung whose neck's rim is at the origin,
 * up and over to what it feeds, with the short rubber sleeve that joins the
 * two.
 *
 * @example
 * <Delivery reach={0.18} rise={0.2} />
 *
 * @param reach - How far to the side the tube ends, in metres; negative to the left
 * @param rise - How far above the rim the tube ends, in metres
 */
export function Delivery({
  reach,
  rise,
}: {
  readonly reach: number;
  readonly rise: number;
}) {
  const { route, sleeve } = useMemo(
    () => deliveryOf(reach, rise),
    [reach, rise]
  );
  return (
    <group>
      <mesh castShadow renderOrder={2}>
        <Sweep ends="open" path={route} radius={DELIVERY.tube} />
        <Borosilicate />
      </mesh>
      <mesh castShadow>
        <Sweep ends="open" path={sleeve} radius={DELIVERY.sleeve} />
        <Rubber />
      </mesh>
    </group>
  );
}
