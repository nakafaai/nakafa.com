"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AnimalLocomotionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/locomotion/lab"
    ).then((module) => ({ default: module.AnimalLocomotionLab }))
  )
);

export const BoneHealthLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/bone/lab").then(
      (module) => ({ default: module.BoneHealthLab })
    )
  )
);

export const JointMovementLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/joint/lab").then(
      (module) => ({ default: module.JointMovementLab })
    )
  )
);

export const MusclePairLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/limb/lab").then(
      (module) => ({ default: module.MusclePairLab })
    )
  )
);

export const VertebraLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/vertebra/lab").then(
      (module) => ({ default: module.VertebraLab })
    )
  )
);
