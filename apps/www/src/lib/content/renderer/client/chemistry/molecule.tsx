"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const MoleculeLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/molecule/lab"
    ).then((module) => ({ default: module.MoleculeLab }))
  )
);

export const ReactionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/equation/lab"
    ).then((module) => ({ default: module.ReactionLab }))
  )
);
