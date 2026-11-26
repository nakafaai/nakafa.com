"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const PhIndicatorScaleLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/indicator/lab"
    ).then((module) => ({ default: module.PhIndicatorScaleLab }))
  )
);

export const SaltBridgeIonFlowLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/bridge/lab").then(
      (module) => ({ default: module.SaltBridgeIonFlowLab })
    )
  )
);
