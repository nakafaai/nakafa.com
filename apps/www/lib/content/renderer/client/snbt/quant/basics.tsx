"use client";

import dynamic from "next/dynamic";

export const LineEquation = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/line-equation"
  ).then(({ LineEquation: Component }) => Component)
);

export const NumberLine = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/number-line"
  ).then(({ NumberLine: Component }) => Component)
);

export const UnitCircle = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/unit-circle"
  ).then(({ UnitCircle }) => UnitCircle)
);
