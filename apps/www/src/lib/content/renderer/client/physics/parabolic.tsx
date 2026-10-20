"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ParabolicMovementLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/lab"
      ).then(({ ParabolicMovementLab }) => ParabolicMovementLab))(),
  }))
);

export const ParabolicMovementAnalysisLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/lab"
      ).then(
        ({ ParabolicMovementAnalysisLab }) => ParabolicMovementAnalysisLab
      ))(),
  }))
);
