"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AverageVelocitySpeedLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/lab"
      ).then(({ AverageVelocitySpeedLab }) => AverageVelocitySpeedLab))(),
  }))
);

export const InstantaneousVelocitySpeedLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/instantaneous-velocity-speed/lab"
      ).then(
        ({ InstantaneousVelocitySpeedLab }) => InstantaneousVelocitySpeedLab
      ))(),
  }))
);

export const VelocitySpeedLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/velocity-speed/lab"
      ).then(({ VelocitySpeedLab }) => VelocitySpeedLab))(),
  }))
);
