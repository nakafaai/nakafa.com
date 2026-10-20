"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set9Question9GraduationChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-9/question-9"
    ).then((module) => ({ default: module.GraduationChart }))
  )
);
