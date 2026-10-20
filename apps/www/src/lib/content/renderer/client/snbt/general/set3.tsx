"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set3Question14SpiceSalesChart = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/snbt/general/set-3/question-14"
      ).then(({ SpiceSalesChart }) => SpiceSalesChart))(),
  }))
);
