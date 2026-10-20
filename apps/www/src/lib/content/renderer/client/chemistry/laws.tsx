"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const CombiningVolumesLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/combining-volumes-law/lab"
    ).then((module) => ({ default: module.CombiningVolumesLab }))
  )
);

export const ConstantCompositionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/constant-composition-law/lab"
    ).then((module) => ({ default: module.ConstantCompositionLab }))
  )
);

export const MassConservationLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/mass-conservation-law/lab"
    ).then((module) => ({ default: module.MassConservationLab }))
  )
);

export const MultipleProportionsLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/multiple-proportions-law/lab"
    ).then((module) => ({ default: module.MultipleProportionsLab }))
  )
);
