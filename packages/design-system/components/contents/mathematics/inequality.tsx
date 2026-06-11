// CoordinateSystem renders a dynamic WebGL canvas with SSR disabled.
// https://nextjs.org/docs/app/guides/lazy-loading#skipping-ssr
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { Inequality as Inequality3D } from "@repo/design-system/components/three/inequality";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import type { ComponentProps, ReactNode } from "react";

interface Props {
  data: ComponentProps<typeof Inequality3D>[];
  description: ReactNode;
  title: ReactNode;
}
/**
 * Renders one card-wrapped inequality visualization with a shared coordinate
 * system shell.
 */
export function Inequality({ title, description, data }: Props) {
  return (
    <Frame className="content-auto-card">
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <CoordinateSystem>
          {data.map((item, index) => (
            <Inequality3D
              key={`inequality-${item.boundaryLine2D?.join("_") || index}`}
              {...item}
            />
          ))}
        </CoordinateSystem>
      </FramePanel>
    </Frame>
  );
}
