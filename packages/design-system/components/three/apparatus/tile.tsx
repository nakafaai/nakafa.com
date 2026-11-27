import { RoundedBox } from "@react-three/drei";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";

/** How thick a white tile is, in metres: what stands on it stands this high. */
export const TILE_HEIGHT = 0.006;

/**
 * A glazed white ceramic tile lying on a surface at y = 0, such as goes
 * under a flask so a colour change shows against white.
 *
 * @example
 * <Tile side={0.11} />
 *
 * @param side - How long each side of the square tile is, in metres
 */
export function Tile({ side }: { readonly side: number }) {
  return (
    <RoundedBox
      args={[side, TILE_HEIGHT, side]}
      castShadow
      position={[0, TILE_HEIGHT / 2, 0]}
      radius={0.0012}
      receiveShadow
      smoothness={3}
    >
      <SurfaceMaterial
        coat={0.7}
        color={LABWARE_COLORS.tile}
        repeat={[2, 2]}
        roughness={0.4}
        surface="ceramic"
      />
    </RoundedBox>
  );
}
