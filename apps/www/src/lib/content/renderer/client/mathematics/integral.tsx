"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AreaBetweenCurvesLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/enclose/lab"
    ).then((module) => ({ default: module.AreaBetweenCurvesLab }))
  )
);

export const RiemannSumConvergenceLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/riemann/lab"
    ).then((module) => ({ default: module.RiemannSumConvergenceLab }))
  )
);

export const SolidOfRevolutionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/revolution/lab"
    ).then((module) => ({ default: module.SolidOfRevolutionLab }))
  )
);
