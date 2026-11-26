"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AsymptoteBehaviorLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/asymptote/lab"
    ).then((module) => ({ default: module.AsymptoteBehaviorLab }))
  )
);

export const EpsilonDeltaBandLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/epsilon/lab"
    ).then((module) => ({ default: module.EpsilonDeltaBandLab }))
  )
);

export const SqueezeTheoremWaveLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/squeeze/lab"
    ).then((module) => ({ default: module.SqueezeTheoremWaveLab }))
  )
);
