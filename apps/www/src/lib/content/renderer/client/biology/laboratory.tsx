"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BodyPlanesLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/planes/lab").then(
      (module) => ({ default: module.BodyPlanesLab })
    )
  )
);

export const LabEquipmentLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/equipment/lab"
    ).then((module) => ({ default: module.LabEquipmentLab }))
  )
);

export const SpecimenDrawingLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/drawing/lab").then(
      (module) => ({ default: module.SpecimenDrawingLab })
    )
  )
);

export const SpillResponseLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/spill/lab").then(
      (module) => ({ default: module.SpillResponseLab })
    )
  )
);

export const WasteSortLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/waste/lab").then(
      (module) => ({ default: module.WasteSortLab })
    )
  )
);
