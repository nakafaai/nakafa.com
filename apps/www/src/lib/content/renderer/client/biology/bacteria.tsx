"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BacteriaStructureLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/bacteria").then(
      (module) => ({ default: module.BacteriaStructureLab })
    )
  )
);
