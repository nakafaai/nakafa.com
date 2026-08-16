"use client";

import type { BacteriaLabItem } from "@repo/design-system/components/contents/biology/bacteria-scene";
import { BacteriaStructureScene } from "@repo/design-system/components/contents/biology/bacteria-scene";
import type {
  BiologyLabProps,
  BiologySceneView,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";

const BACTERIA_VIEW = {
  cameraPosition: [2.28, 1.58, 3.3],
  cameraTarget: [0, -0.05, 0],
  narrowCameraPosition: [2.64, 1.82, 3.9],
} satisfies BiologySceneView;

/**
 * Renders bacterial shape, structure, and cell-wall comparison views.
 */
export function BacteriaStructureLab(props: BiologyLabProps<BacteriaLabItem>) {
  return (
    <BiologyLabFrame
      scene={BacteriaStructureScene}
      view={BACTERIA_VIEW}
      {...props}
    />
  );
}
