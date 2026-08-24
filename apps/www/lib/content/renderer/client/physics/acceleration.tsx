"use client";

import dynamic from "next/dynamic";

export const AccelerationGraphCard = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/acceleration/chart-card"
  ).then(({ AccelerationGraphCard }) => AccelerationGraphCard)
);

export const AccelerationLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/acceleration/lab"
  ).then(({ AccelerationLab }) => AccelerationLab)
);
