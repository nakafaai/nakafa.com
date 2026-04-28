import type {
  MeasurementSceneProps,
  MeasurementToolId,
} from "@repo/design-system/components/contents/physics/measurement/tools/data";
import {
  LENGTH_TOOL_ID,
  MASS_TOOL_ID,
  TIME_TOOL_ID,
} from "@repo/design-system/components/contents/physics/measurement/tools/data";
import { LengthScene } from "@repo/design-system/components/contents/physics/measurement/tools/length";
import { MassScene } from "@repo/design-system/components/contents/physics/measurement/tools/mass";
import { TimeScene } from "@repo/design-system/components/contents/physics/measurement/tools/time";

const TOOL_SCENES = {
  [LENGTH_TOOL_ID]: LengthScene,
  [MASS_TOOL_ID]: MassScene,
  [TIME_TOOL_ID]: TimeScene,
};

/**
 * Chooses the active 3D scene without mounting hidden instruments.
 */
export function MeasurementScene({
  selectedToolId,
  ...sceneProps
}: MeasurementSceneProps & { selectedToolId: MeasurementToolId }) {
  const ActiveScene = TOOL_SCENES[selectedToolId];

  return <ActiveScene {...sceneProps} />;
}
