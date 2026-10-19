import type { SceneColors } from "@repo/design-system/components/contents/physics/measurement/tools/data";
import {
  LENGTH_TOOL_ID,
  MASS_TOOL_ID,
  TIME_TOOL_ID,
} from "@repo/design-system/components/contents/physics/measurement/tools/data";
import { LengthScene } from "@repo/design-system/components/contents/physics/measurement/tools/length";
import { MassScene } from "@repo/design-system/components/contents/physics/measurement/tools/mass";
import { TimeScene } from "@repo/design-system/components/contents/physics/measurement/tools/time";
import type { ReactNode } from "react";

/** The 3D scene of each instrument, keyed by its tool, so the lab mounts only the selected one. */
export const TOOL_SCENES = {
  [LENGTH_TOOL_ID]: LengthScene,
  [MASS_TOOL_ID]: MassScene,
  [TIME_TOOL_ID]: TimeScene,
};

export interface MeasurementSceneProps {
  colors: SceneColors;
  measurement: number;
  reading: ReactNode;
}
