"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const NonUniformLinearMotionGraphCard = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/chart-card"
      ).then(
        ({ NonUniformLinearMotionGraphCard }) => NonUniformLinearMotionGraphCard
      ))(),
  }))
);

export const NonUniformLinearMotionLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/lab"
      ).then(({ NonUniformLinearMotionLab }) => NonUniformLinearMotionLab))(),
  }))
);

export const UniformLinearMotionLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/uniform-linear-motion/lab"
      ).then(({ UniformLinearMotionLab }) => UniformLinearMotionLab))(),
  }))
);
