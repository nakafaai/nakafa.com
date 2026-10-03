"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DisplacementDistanceLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/displacement-distance/lab"
    ).then(({ DisplacementDistanceLab }) => DisplacementDistanceLab)
  )
);

export const StoppingDistanceLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/stopping-distance/lab"
    ).then(({ StoppingDistanceLab }) => StoppingDistanceLab)
  )
);
