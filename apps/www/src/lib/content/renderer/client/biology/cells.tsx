"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const CellCutawayLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/cell/cutaway").then(
      (module) => ({ default: module.CellCutawayLab })
    )
  )
);

export const CellScaleLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/cell/scale").then(
      (module) => ({ default: module.CellScaleLab })
    )
  )
);

export const DnaHelixLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/dna/helix").then(
      (module) => ({ default: module.DnaHelixLab })
    )
  )
);
