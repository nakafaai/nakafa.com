import { Billboard } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import type { ColorRepresentation } from "three";
import { BackSide } from "three";

/** Round enough that a marker never shows a facet at any zoom. */
const SEGMENTS = 32;
/** How far a marker's rim stands out past its fill, as a share of its radius. */
const RIM = 0.22;
/** The width of an open marker's ring, as a share of its radius. */
const RING = 0.34;

/**
 * A point of a graph: a round, unlit dot with a thin rim in the card's ink, so
 * it stays crisp over a curve, a grid line or a translucent solid from every
 * side. A `hollow` marker is an open point, such as a removable hole: a ring
 * that faces the camera and shows the graph through its middle.
 */
export function GraphMarker({
  color,
  hollow = false,
  position,
  radius = 0.07,
}: {
  readonly color: ColorRepresentation;
  readonly hollow?: boolean;
  readonly position: ThreeElements["group"]["position"];
  readonly radius?: number;
}) {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const rim =
    getThemeAppearance(resolvedTheme) === "dark"
      ? ORIGIN_COLOR.LIGHT
      : ORIGIN_COLOR.DARK;

  if (hollow) {
    return (
      <Billboard {...(position === undefined ? {} : { position })}>
        <mesh>
          <ringGeometry args={[radius * (1 - RING), radius, SEGMENTS * 2]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </Billboard>
    );
  }

  return (
    <group {...(position === undefined ? {} : { position })}>
      <mesh>
        <sphereGeometry args={[radius, SEGMENTS, SEGMENTS]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * (1 + RIM), SEGMENTS, SEGMENTS]} />
        <meshBasicMaterial color={rim} side={BackSide} toneMapped={false} />
      </mesh>
    </group>
  );
}
