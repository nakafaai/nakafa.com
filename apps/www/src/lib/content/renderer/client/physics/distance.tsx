"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DisplacementDistanceLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/displacement-distance/lab"
      ).then(({ DisplacementDistanceLab }) => DisplacementDistanceLab))(),
  }))
);

export const StoppingDistanceLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/stopping-distance/lab"
      ).then(({ StoppingDistanceLab }) => StoppingDistanceLab))(),
  }))
);
