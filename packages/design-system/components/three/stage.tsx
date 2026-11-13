import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { StageProvider } from "@repo/design-system/components/three/stage/context";
import { Finish } from "@repo/design-system/components/three/stage/finish";
import { Ground } from "@repo/design-system/components/three/stage/ground";
import {
  FieldSetting,
  LabSetting,
  SkySetting,
  SpaceSetting,
  StudioSetting,
} from "@repo/design-system/components/three/stage/settings";
import type { ReactNode } from "react";

/** How far a lab reaches from its middle when it names no reach, in scene units. */
const DEFAULT_REACH = 5;

/** The places a lab can stand in, each with its own light and backdrop. */
const SETTINGS = {
  field: FieldSetting,
  lab: LabSetting,
  sky: SkySetting,
  space: SpaceSetting,
  studio: StudioSetting,
};

/**
 * The stage every science lab stands on, in the place its subject belongs: a
 * teaching laboratory, an open field, the open sky, open space, or a photo
 * studio. The place lights the lab, stands behind it, and sets where its key
 * light and shadows fall, and every lab is drawn through the same
 * photographic finish. A lab never draws a backdrop of its own.
 * A lab with a floor names its height, and an unseen ground then catches its
 * shadows.
 *
 * @param setting - The place the lab stands in
 * @param reach - How far the lab reaches from its middle, which the key
 * light's shadows, the haze, and the focus cover
 * @param floor - The height of the floor objects stand on, when there is one
 */
export function ScienceStage({
  children,
  floor,
  frameloop = "demand",
  reach = DEFAULT_REACH,
  setting,
}: {
  readonly children: ReactNode;
  readonly floor?: number;
  readonly frameloop?: "always" | "demand";
  readonly reach?: number;
  readonly setting: keyof typeof SETTINGS;
}) {
  const Setting = SETTINGS[setting];

  return (
    <ThreeCanvas frameloop={frameloop}>
      <StageProvider floor={floor} reach={reach}>
        <Setting />
        <Ground />
        {children}
        <Finish />
      </StageProvider>
    </ThreeCanvas>
  );
}
