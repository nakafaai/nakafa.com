"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const NumberLine = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/number-line"
    ).then(({ NumberLine: Component }) => Component)
  )
);
