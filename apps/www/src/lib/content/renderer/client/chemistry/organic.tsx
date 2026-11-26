"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AlkaneAlkeneIsomerLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/isomer/lab").then(
      (module) => ({ default: module.AlkaneAlkeneIsomerLab })
    )
  )
);

export const EsterificationRefluxLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/ester/lab").then(
      (module) => ({ default: module.EsterificationRefluxLab })
    )
  )
);

export const FractionalDistillationLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/fraction/lab"
    ).then((module) => ({ default: module.FractionalDistillationLab }))
  )
);
