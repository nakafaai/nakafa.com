// CoordinateSystem renders a dynamic WebGL canvas with SSR disabled.
// https://nextjs.org/docs/app/guides/lazy-loading#skipping-ssr
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { LineEquation as LineEquation3D } from "@repo/design-system/components/three/line-equation";
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
  data: ComponentProps<typeof LineEquation3D>[];
  description: ReactNode;
  showZAxis?: boolean;
  title: ReactNode;
}

/**
 * Renders one interactive line-equation card with the shared coordinate system.
 */
export function LineEquation({
  title,
  description,
  data,
  cameraPosition = [
    DEFAULT_CAMERA_POSITION_X,
    DEFAULT_CAMERA_POSITION_Y,
    DEFAULT_CAMERA_POSITION_Z,
  ],
  showZAxis = true,
}: Props) {
  return (
    <Frame className="content-auto-card">
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <CoordinateSystem cameraPosition={cameraPosition} showZAxis={showZAxis}>
          {data.map((item) => (
            <LineEquation3D
              key={`line-${item.points.map((p) => `${p.x},${p.y},${p.z}`).join(";")}`}
              {...item}
            />
          ))}
        </CoordinateSystem>
      </FramePanel>
    </Frame>
  );
}
