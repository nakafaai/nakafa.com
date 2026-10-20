"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set2Question15SalesChart = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/snbt/general/set-2/question-15"
      ).then(({ SalesChart }) => SalesChart))(),
  }))
);

export const Set2Question5SalesChart = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/snbt/general/set-2/question-5"
      ).then(({ SalesChart }) => SalesChart))(),
  }))
);
