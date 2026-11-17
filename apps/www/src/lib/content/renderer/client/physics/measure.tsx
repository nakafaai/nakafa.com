"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const MotionAreaLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measure/area/lab"
    ).then((module) => ({ default: module.MotionAreaLab }))
  )
);

export const PendulumGraphLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measure/pendulum/lab"
    ).then((module) => ({ default: module.PendulumGraphLab }))
  )
);

export const ReadingSpreadLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measure/spread/lab"
    ).then((module) => ({ default: module.ReadingSpreadLab }))
  )
);
