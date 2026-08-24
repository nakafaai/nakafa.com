"use client";

import dynamic from "next/dynamic";

export const Triangle = dynamic(() =>
  import("@repo/design-system/components/contents/mathematics/triangle").then(
    ({ Triangle }) => Triangle
  )
);

export const UnitCircle = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/unit-circle"
  ).then(({ UnitCircle }) => UnitCircle)
);
