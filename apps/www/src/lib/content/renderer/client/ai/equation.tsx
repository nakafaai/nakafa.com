"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const LineEquation = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/line/equation"
      ).then(({ LineEquation: Component }) => Component))(),
  }))
);
