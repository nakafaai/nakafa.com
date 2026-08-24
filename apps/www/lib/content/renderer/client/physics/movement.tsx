"use client";

import dynamic from "next/dynamic";

export const RelativeMovementLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/relative-movement/lab"
  ).then(({ RelativeMovementLab }) => RelativeMovementLab)
);

export const VerticalMovementLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/vertical-movement/lab"
  ).then(({ VerticalMovementLab }) => VerticalMovementLab)
);
