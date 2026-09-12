// CoordinateSystem renders a dynamic WebGL canvas with SSR disabled.
// https://nextjs.org/docs/app/guides/lazy-loading#skipping-ssr
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { Inequality as Inequality3D } from "@repo/design-system/components/three/inequality";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { ComponentProps, ReactNode } from "react";

interface Props {
  cameraPosition?: ComponentProps<typeof CoordinateSystem>["cameraPosition"];
  cameraTarget?: ComponentProps<typeof CoordinateSystem>["cameraTarget"];
  data: ComponentProps<typeof Inequality3D>[];
  description: ReactNode;
  title: ReactNode;
}
/**
 * Renders one card-wrapped inequality visualization with a shared coordinate
 * system shell.
 */
export function Inequality({
  title,
  description,
  data,
  cameraPosition,
  cameraTarget,
}: Props) {
  return (
    <CoordinateProvider>
      <Card className="content-auto-card">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <CoordinateSystem
            cameraPosition={
              cameraPosition ??
              (data.every((item) => item.is2D) ? [0, 0, 15] : undefined)
            }
            cameraTarget={cameraTarget}
          >
            {data.map((item, index) => (
              <Inequality3D
                key={`inequality-${item.boundaryLine2D?.join("_") || index}`}
                {...item}
              />
            ))}
          </CoordinateSystem>
        </CardContent>
        <CoordinateControls />
      </Card>
    </CoordinateProvider>
  );
}
