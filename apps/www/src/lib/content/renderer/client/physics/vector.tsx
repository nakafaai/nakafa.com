"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const VectorConceptLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/vector/concept/lab"
      ).then(({ VectorConceptLab }) => VectorConceptLab))(),
  }))
);
