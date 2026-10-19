"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Triangle = withHydrationBoundary(
  dynamic(() =>
    import("@repo/design-system/components/contents/mathematics/triangle").then(
      ({ Triangle }) => Triangle
    )
  )
);

export const UnitCircle = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/unit-circle"
    ).then(({ UnitCircle }) => UnitCircle)
  )
);
