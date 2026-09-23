"use client";

import dynamic from "next/dynamic";

export const VectorConceptLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/vector/concept/lab"
  ).then(({ VectorConceptLab }) => VectorConceptLab)
);
