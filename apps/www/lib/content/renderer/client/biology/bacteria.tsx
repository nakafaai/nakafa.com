"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BacteriaStructureLab = withHydrationBoundary(
  dynamic(() =>
    import("@repo/design-system/components/contents/biology/bacteria").then(
      ({ BacteriaStructureLab }) => BacteriaStructureLab
    )
  )
);
