"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const UnitCircle = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/unit-circle"
      ).then(({ UnitCircle }) => UnitCircle))(),
  }))
);
