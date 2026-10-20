"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const NepotismStage = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/politics/nepotism/stage"
      ).then(({ Stage }) => Stage))(),
  }))
);
