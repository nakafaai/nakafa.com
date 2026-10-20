"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Inequality = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/inequality"
      ).then(({ Inequality: Component }) => Component))(),
  }))
);

export const LineEquation = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/line/equation"
      ).then(({ LineEquation: Component }) => Component))(),
  }))
);

export const QuadraticEquationReadingRoomProblem = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/quadratic/reading-room"
      ).then(({ ReadingRoomProblem }) => ReadingRoomProblem))(),
  }))
);
