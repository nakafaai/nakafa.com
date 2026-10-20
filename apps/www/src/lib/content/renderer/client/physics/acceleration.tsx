"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AccelerationGraphCard = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/acceleration/chart-card"
      ).then(({ AccelerationGraphCard }) => AccelerationGraphCard))(),
  }))
);

export const AccelerationLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/acceleration/lab"
      ).then(({ AccelerationLab }) => AccelerationLab))(),
  }))
);
