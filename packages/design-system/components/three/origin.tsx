import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { GRAPH_POINT_SEGMENTS } from "@repo/design-system/components/three/helpers/quality";
import type { ComponentProps } from "react";

/**
 * Renders the origin marker shared by coordinate-system based 3D content.
 */
export function Origin({
  size = 0.2,
  color = ORIGIN_COLOR.LIGHT,
  ...props
}: {
  size?: number;
  color?: string;
} & ComponentProps<"mesh">) {
  return (
    <mesh {...props}>
      <sphereGeometry
        args={[size, GRAPH_POINT_SEGMENTS, GRAPH_POINT_SEGMENTS]}
      />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}
