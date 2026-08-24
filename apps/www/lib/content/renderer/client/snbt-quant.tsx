"use client";

import dynamic from "next/dynamic";

export const LazyUnitCircle = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/unit-circle"
  ).then(({ UnitCircle }) => UnitCircle)
);
