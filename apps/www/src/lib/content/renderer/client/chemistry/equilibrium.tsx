"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DynamicEquilibriumLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/equilibrium/lab"
    ).then((module) => ({ default: module.DynamicEquilibriumLab }))
  )
);

export const EquilibriumQuotientLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/quotient/lab"
    ).then((module) => ({ default: module.EquilibriumQuotientLab }))
  )
);

export const LeChatelierLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/lechatelier/lab"
    ).then((module) => ({ default: module.LeChatelierLab }))
  )
);
