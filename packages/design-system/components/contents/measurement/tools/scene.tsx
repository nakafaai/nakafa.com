import type { MeasurementSceneProps, MeasurementToolId } from "./data";
import { LENGTH_TOOL_ID, MASS_TOOL_ID, TIME_TOOL_ID } from "./data";
import { LengthScene } from "./length";
import { MassScene } from "./mass";
import { TimeScene } from "./time";

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
