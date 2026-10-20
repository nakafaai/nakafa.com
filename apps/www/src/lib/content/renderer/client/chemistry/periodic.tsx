"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ModernPeriodicTableLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/modern-periodic-table/lab"
    ).then((module) => ({ default: module.ModernPeriodicTableLab }))
  )
);

export const PeriodicPropertiesLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/periodic-properties/lab"
    ).then((module) => ({ default: module.PeriodicPropertiesLab }))
  )
);
