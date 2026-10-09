// CoordinateSystem renders a dynamic WebGL canvas with SSR disabled.
// https://nextjs.org/docs/app/guides/lazy-loading#skipping-ssr

import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { Inequality as Inequality3D } from "@repo/design-system/components/three/inequality";
import {
  VisualCard,
  VisualCardBody,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { Array as Arr } from "effect";
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
  const isPlanar = Arr.every(data, (item) => Boolean(item.is2D));
  const position: Props["cameraPosition"] =
    cameraPosition ?? (isPlanar ? [0, 0, 15] : undefined);
  const isFrontalPlane =
    isPlanar &&
    position?.[0] === (cameraTarget?.[0] ?? 0) &&
    position?.[1] === (cameraTarget?.[1] ?? 0);

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <VisualCardBody>
          <CoordinateSystem
            cameraPosition={position}
            cameraProjection={
              isFrontalPlane ? { kind: "orthographic" } : undefined
            }
            cameraTarget={cameraTarget}
          >
            {Arr.map(data, (item, index) => (
              <Inequality3D
                key={`inequality-${(item.boundaryLine2D ? Arr.join(Arr.map(item.boundaryLine2D, String), "_") : undefined) || index}`}
                {...item}
              />
            ))}
          </CoordinateSystem>
        </VisualCardBody>
        <CoordinateControls />
      </VisualCard>
    </CoordinateProvider>
  );
}
