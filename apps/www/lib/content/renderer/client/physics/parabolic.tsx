"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ParabolicMovementLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/lab"
    ).then(({ ParabolicMovementLab }) => ParabolicMovementLab)
  )
);

export const ParabolicMovementAnalysisLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/lab"
    ).then(({ ParabolicMovementAnalysisLab }) => ParabolicMovementAnalysisLab)
  )
);
