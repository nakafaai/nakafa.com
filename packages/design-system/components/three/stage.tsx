import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { StageProvider } from "@repo/design-system/components/three/stage/context";
import { Finish } from "@repo/design-system/components/three/stage/finish";
import type { GroundSchema } from "@repo/design-system/components/three/stage/grain";
import { Ground } from "@repo/design-system/components/three/stage/ground";
import {
  FieldSetting,
  LabSetting,
  SETTING_SUNS,
  SkySetting,
  SpaceSetting,
  StudioSetting,
} from "@repo/design-system/components/three/stage/settings";
import type { ReactNode } from "react";
import { NeutralToneMapping } from "three";

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
 * photographic finish. A lab never draws a backdrop of its own. The canvas
 * tone maps with PBR Neutral, which the finish takes over while it draws.
 * A lab with a floor names its height, and one that stands on real ground
 * names what the ground is made of: the stage then draws that ground as far
 * as the haze, so no lab draws a slab of its own.
 *
 * @param setting - The place the lab stands in
 * @param reach - How far the lab reaches from its middle, which the key
 * light's shadows, the haze, and the focus cover
 * @param floor - The height of the floor objects stand on, when there is one
 * @param ground - What the ground is made of, when the lab stands on real ground
 */
export function ScienceStage({
  children,
  floor,
  frameloop = "demand",
  ground,
  reach = DEFAULT_REACH,
  setting,
}: {
  readonly children: ReactNode;
  readonly floor?: number;
  readonly frameloop?: "always" | "demand";
  readonly ground?: typeof GroundSchema.Type;
  readonly reach?: number;
  readonly setting: keyof typeof SETTINGS;
}) {
  const Setting = SETTINGS[setting];

  return (
    <ThreeCanvas frameloop={frameloop} toneMapping={NeutralToneMapping}>
      <StageProvider
        floor={floor}
        ground={ground}
        reach={reach}
        sun={SETTING_SUNS[setting]}
      >
        <Setting />
        <Ground />
        {children}
        <Finish />
      </StageProvider>
    </ThreeCanvas>
  );
}
