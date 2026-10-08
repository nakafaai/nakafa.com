"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const RelativeMovementLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/relative-movement/lab"
    ).then(({ RelativeMovementLab }) => RelativeMovementLab)
  )
);

export const VerticalMovementLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/vertical-movement/lab"
    ).then(({ VerticalMovementLab }) => VerticalMovementLab)
  )
);
