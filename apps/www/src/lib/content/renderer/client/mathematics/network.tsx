"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const RouteNetworkLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/network/lab"
    ).then((module) => ({ default: module.RouteNetworkLab }))
  )
);
