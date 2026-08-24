"use client";

import dynamic from "next/dynamic";

export const SequenceConceptTableChairsAnimation = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/sequence/animation"
  ).then(({ default: Animation }) => Animation)
);
