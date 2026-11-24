"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ActiveTransportPumpLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/pump/lab").then(
      (module) => ({ default: module.ActiveTransportPumpLab })
    )
  )
);

export const PlasmolysisCellLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/plasmolysis/lab"
    ).then((module) => ({ default: module.PlasmolysisCellLab }))
  )
);
