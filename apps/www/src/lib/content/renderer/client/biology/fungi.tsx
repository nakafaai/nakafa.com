"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const FungiMyceliumLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import("@repo/design-system/components/contents/biology/fungi").then(
        ({ FungiMyceliumLab }) => FungiMyceliumLab
      ))(),
  }))
);
