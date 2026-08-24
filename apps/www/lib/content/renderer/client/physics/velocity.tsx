"use client";

import dynamic from "next/dynamic";

export const AverageVelocitySpeedLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/lab"
  ).then(({ AverageVelocitySpeedLab }) => AverageVelocitySpeedLab)
);

export const InstantaneousVelocitySpeedLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/instantaneous-velocity-speed/lab"
  ).then(({ InstantaneousVelocitySpeedLab }) => InstantaneousVelocitySpeedLab)
);

export const VelocitySpeedLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/velocity-speed/lab"
  ).then(({ VelocitySpeedLab }) => VelocitySpeedLab)
);
