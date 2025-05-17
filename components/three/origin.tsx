import type { ComponentProps } from "react";
import { ORIGIN_COLOR } from "./_data";

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
      <sphereGeometry args={[size, 16, 16]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}
