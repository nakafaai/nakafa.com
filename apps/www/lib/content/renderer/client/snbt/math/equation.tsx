"use client";

import dynamic from "next/dynamic";

export const LineEquation = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/line/equation"
  ).then(({ LineEquation: Component }) => Component)
);
