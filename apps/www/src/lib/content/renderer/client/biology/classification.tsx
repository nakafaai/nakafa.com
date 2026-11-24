"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const GardenNameLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/binomial/lab").then(
      (module) => ({ default: module.GardenNameLab })
    )
  )
);

export const KeyBuilderLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/key/lab").then(
      (module) => ({ default: module.KeyBuilderLab })
    )
  )
);

export const KingdomSortLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/kingdom/lab").then(
      (module) => ({ default: module.KingdomSortLab })
    )
  )
);

export const SeaNameLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/vernacular/lab"
    ).then((module) => ({ default: module.SeaNameLab }))
  )
);

export const TaxonRankLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/taxon/lab").then(
      (module) => ({ default: module.TaxonRankLab })
    )
  )
);
