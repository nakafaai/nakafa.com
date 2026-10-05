"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const FungiMyceliumLab = withHydrationBoundary(
  dynamic(() =>
    import("@repo/design-system/components/contents/biology/fungi").then(
      ({ FungiMyceliumLab }) => FungiMyceliumLab
    )
  )
);
