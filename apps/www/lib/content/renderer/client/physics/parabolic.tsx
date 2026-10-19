"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ParabolicMovementLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/lab"
    ).then(({ ParabolicMovementLab }) => ParabolicMovementLab)
  )
);

export const ParabolicMovementAnalysisLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/lab"
    ).then(({ ParabolicMovementAnalysisLab }) => ParabolicMovementAnalysisLab)
  )
);
