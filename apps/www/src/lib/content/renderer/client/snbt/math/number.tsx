"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const NumberLine = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/number-line"
    ).then((module) => ({ default: module.NumberLine }))
  )
);
