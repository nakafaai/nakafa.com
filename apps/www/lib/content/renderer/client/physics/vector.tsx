"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const VectorConceptLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/concept/lab"
    ).then(({ VectorConceptLab }) => VectorConceptLab)
  )
);
