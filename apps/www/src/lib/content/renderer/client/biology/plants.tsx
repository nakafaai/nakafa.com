"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const FertilisationLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/fertilisation/lab"
    ).then((module) => ({ default: module.FertilisationLab }))
  )
);

export const OsmosisLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/osmosis/lab").then(
      (module) => ({ default: module.OsmosisLab })
    )
  )
);

export const PhotosynthesisLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/photosynthesis/lab"
    ).then((module) => ({ default: module.PhotosynthesisLab }))
  )
);

export const PotometerLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/potometer/lab"
    ).then((module) => ({ default: module.PotometerLab }))
  )
);

export const TropismLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/tropism/lab").then(
      (module) => ({ default: module.TropismLab })
    )
  )
);
