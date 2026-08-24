"use client";

import dynamic from "next/dynamic";

export const Vector3d = dynamic(() =>
  import("@repo/design-system/components/contents/mathematics/vector-3d").then(
    ({ Vector3d: Component }) => Component
  )
);
