// CoordinateSystem renders a dynamic WebGL canvas with SSR disabled.
// https://nextjs.org/docs/app/guides/lazy-loading#skipping-ssr
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { Vector } from "@repo/design-system/components/three/vector";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { ComponentProps, ReactNode } from "react";

const DEFAULT_CAMERA_POSITION_X = 10;
const DEFAULT_CAMERA_POSITION_Y = 6;
const DEFAULT_CAMERA_POSITION_Z = 10;

interface Props {
  cameraPosition?: [number, number, number];
  /** Custom point the camera looks at in Three.js world coordinates */
  cameraTarget?: [number, number, number];
  description: ReactNode;
  title: ReactNode;
  vectors: ComponentProps<typeof Vector>[];
}

/**
 * Renders one interactive 3D vector card with the shared coordinate system.
 */
export function Vector3d({
  title,
  description,
  vectors,
  cameraPosition = [
    DEFAULT_CAMERA_POSITION_X,
    DEFAULT_CAMERA_POSITION_Y,
    DEFAULT_CAMERA_POSITION_Z,
  ],
  cameraTarget,
}: Props) {
  const isFrontalPlane =
    cameraPosition[0] === (cameraTarget?.[0] ?? 0) &&
    cameraPosition[1] === (cameraTarget?.[1] ?? 0) &&
    vectors.every(
      (vector) => (vector.from?.[2] ?? 0) === 0 && vector.to[2] === 0
    );

  return (
    <CoordinateProvider>
      <Card className="content-auto-card">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <CoordinateSystem
            cameraPosition={cameraPosition}
            cameraProjection={
              isFrontalPlane ? { kind: "orthographic" } : undefined
            }
            cameraTarget={cameraTarget}
            showZAxis={!isFrontalPlane}
          >
            {vectors.map((vector) => (
              <Vector
                key={`vector-${vector.from?.join(",")}-${vector.to.join(",")}`}
                {...vector}
              />
            ))}
          </CoordinateSystem>
        </CardContent>
        <CoordinateControls />
      </Card>
    </CoordinateProvider>
  );
}
