// CoordinateSystem renders a dynamic WebGL canvas with SSR disabled.
// https://nextjs.org/docs/app/guides/lazy-loading#skipping-ssr
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { Vector } from "@repo/design-system/components/three/vector";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
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
  return (
    <Frame className="content-auto-card">
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <CoordinateSystem
          cameraPosition={cameraPosition}
          cameraTarget={cameraTarget}
        >
          {vectors.map((vector) => (
            <Vector
              key={`vector-${vector.from?.join(",")}-${vector.to.join(",")}`}
              {...vector}
            />
          ))}
        </CoordinateSystem>
      </FramePanel>
    </Frame>
  );
}
