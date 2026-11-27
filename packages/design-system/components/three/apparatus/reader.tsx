import { RoundedBox } from "@react-three/drei";
import {
  CARD,
  cardOf,
} from "@repo/design-system/components/three/apparatus/card";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";

/**
 * A burette reader card held behind a burette whose axis is the y axis, the
 * top of its black band just under the meniscus, so the meniscus reads as
 * a sharp dark curve against white.
 *
 * @example
 * <ReaderCard meniscus={TIP_END + meniscusOf(reading)} radius={BURETTE.radius} />
 *
 * @param meniscus - The height of the meniscus, in metres
 * @param radius - The burette's outer radius, in metres
 */
export function ReaderCard({
  meniscus,
  radius,
}: {
  readonly meniscus: number;
  readonly radius: number;
}) {
  const card = cardOf(meniscus, radius);
  return (
    <group position={[0, 0, card.back]}>
      <RoundedBox
        args={[CARD.width, CARD.height, CARD.thick]}
        position={[0, card.middle, 0]}
        radius={0.0003}
        smoothness={2}
      >
        <SurfaceMaterial
          color={LABWARE_COLORS.card}
          roughness={0.9}
          surface="plastic"
        />
      </RoundedBox>
      <RoundedBox
        args={[CARD.width, CARD.band, CARD.thick * 0.5]}
        position={[0, card.band, CARD.thick * 0.6]}
        radius={0.0002}
        smoothness={2}
      >
        <SurfaceMaterial
          color={LABWARE_COLORS.cardBand}
          roughness={0.95}
          surface="plastic"
        />
      </RoundedBox>
    </group>
  );
}
