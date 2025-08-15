import type { ComponentProps } from "react";
import { ORIGIN_COLOR } from "./_data";

const SPHERE_GEOMETRY_SEGMENTS = 16;

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
        args={[size, SPHERE_GEOMETRY_SEGMENTS, SPHERE_GEOMETRY_SEGMENTS]}
      />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}
