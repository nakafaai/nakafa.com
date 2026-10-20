"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const NepotismStage = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/politics/nepotism/stage"
    ).then((module) => ({ default: module.Stage }))
  )
);
