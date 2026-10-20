"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DisplacementDistanceLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/displacement-distance/lab"
    ).then(({ DisplacementDistanceLab }) => DisplacementDistanceLab)
  )
);

export const StoppingDistanceLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/stopping-distance/lab"
    ).then(({ StoppingDistanceLab }) => StoppingDistanceLab)
  )
);
