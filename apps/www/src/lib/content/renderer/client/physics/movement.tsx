"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const RelativeMovementLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/relative-movement/lab"
      ).then(({ RelativeMovementLab }) => RelativeMovementLab))(),
  }))
);

export const VerticalMovementLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/vertical-movement/lab"
      ).then(({ VerticalMovementLab }) => VerticalMovementLab))(),
  }))
);
