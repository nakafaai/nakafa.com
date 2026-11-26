"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AdditionPolymerChainLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/addition/lab"
    ).then((module) => ({ default: module.AdditionPolymerChainLab }))
  )
);

export const CondensationNylonLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/nylon/lab").then(
      (module) => ({ default: module.CondensationNylonLab })
    )
  )
);

export const RubberVulcanizationLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/rubber/lab").then(
      (module) => ({ default: module.RubberVulcanizationLab })
    )
  )
);
