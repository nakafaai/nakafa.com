"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AccelerationGraphCard = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/acceleration/chart-card"
    ).then(({ AccelerationGraphCard }) => AccelerationGraphCard)
  )
);

export const AccelerationLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/acceleration/lab"
    ).then(({ AccelerationLab }) => AccelerationLab)
  )
);
