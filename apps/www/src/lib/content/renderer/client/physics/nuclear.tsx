"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const FissionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/nuclear/fission/lab"
    ).then((module) => ({ default: module.FissionLab }))
  )
);

export const HalfLifeCounterLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/nuclear/counter/lab"
    ).then((module) => ({ default: module.HalfLifeCounterLab }))
  )
);

export const NuclearBindingCurveLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/physics/binding/lab").then(
      (module) => ({ default: module.NuclearBindingCurveLab })
    )
  )
);

export const PhotoelectricLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/nuclear/photo/lab"
    ).then((module) => ({ default: module.PhotoelectricLab }))
  )
);
