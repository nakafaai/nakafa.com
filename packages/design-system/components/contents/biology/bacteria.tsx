"use client";

import type { BacteriaLabItemProps } from "@repo/design-system/components/contents/biology/bacteria-scene";
import { BacteriaStructureScene } from "@repo/design-system/components/contents/biology/bacteria-scene";
import {
  BiologyLabFrame,
  type BiologyLabProps,
} from "@repo/design-system/components/contents/biology/lab-frame";
import type { NarrowCameraPose } from "@repo/design-system/lib/geometry/camera";

const BACTERIA_VIEW = {
  cameraPosition: [2.28, 1.58, 3.3],
  cameraTarget: [0, -0.05, 0],
  narrowCameraPosition: [2.64, 1.82, 3.9],
} satisfies NarrowCameraPose;

/**
 * Renders bacterial shape, structure, and cell-wall comparison views.
 */
export function BacteriaStructureLab(
  props: BiologyLabProps<BacteriaLabItemProps>
) {
  return (
    <BiologyLabFrame
      scene={BacteriaStructureScene}
      view={BACTERIA_VIEW}
      {...props}
    />
  );
}
