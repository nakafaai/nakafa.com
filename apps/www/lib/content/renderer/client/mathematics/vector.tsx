"use client";

import dynamic from "next/dynamic";

/** Retains the active dev corpus contract until its paired migration is accepted. */
export const Vector3d = dynamic(() =>
  import("@repo/design-system/components/contents/mathematics/vectors").then(
    ({ Vector3d }) => Vector3d
  )
);
