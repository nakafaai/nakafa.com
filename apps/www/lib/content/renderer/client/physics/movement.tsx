"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const RelativeMovementLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/relative-movement/lab"
    ).then(({ RelativeMovementLab }) => RelativeMovementLab)
  )
);

export const VerticalMovementLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/vertical-movement/lab"
    ).then(({ VerticalMovementLab }) => VerticalMovementLab)
  )
);
