"use client";

import dynamic from "next/dynamic";

export const DimensionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/measurement/dimension/lab"
  ).then(({ DimensionLab }) => DimensionLab)
);

export const MeasurementToolsLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/measurement/tools/lab"
  ).then(({ MeasurementToolsLab }) => MeasurementToolsLab)
);
