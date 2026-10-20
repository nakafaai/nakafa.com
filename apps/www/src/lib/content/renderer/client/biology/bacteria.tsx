"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BacteriaStructureLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import("@repo/design-system/components/contents/biology/bacteria").then(
        ({ BacteriaStructureLab }) => BacteriaStructureLab
      ))(),
  }))
);
