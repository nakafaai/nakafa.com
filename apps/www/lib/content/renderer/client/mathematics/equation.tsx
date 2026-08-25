"use client";

import dynamic from "next/dynamic";

export const Inequality = dynamic(() =>
  import("@repo/design-system/components/contents/mathematics/inequality").then(
    ({ Inequality: Component }) => Component
  )
);

export const LineEquation = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/line/equation"
  ).then(({ LineEquation: Component }) => Component)
);

export const QuadraticEquationReadingRoomProblem = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/quadratic/reading-room"
  ).then(({ ReadingRoomProblem }) => ReadingRoomProblem)
);
