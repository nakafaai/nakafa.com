import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { StageProvider } from "@repo/design-system/components/three/stage/context";
import { Finish } from "@repo/design-system/components/three/stage/finish";
import { Ground } from "@repo/design-system/components/three/stage/ground";
import type { Ground as GroundKind } from "@repo/design-system/components/three/stage/land";
import {
  CellSetting,
  MicroscopeSetting,
  WaterSetting,
} from "@repo/design-system/components/three/stage/medium";
import type { Place } from "@repo/design-system/components/three/stage/place";
import { standsOn } from "@repo/design-system/components/three/stage/place";
import {
  DarkSetting,
  FieldSetting,
  LabSetting,
  SETTING_SUNS,
  SkySetting,
  SpaceSetting,
  StudioSetting,
} from "@repo/design-system/components/three/stage/settings";
import type { ComponentType } from "react";
import type { ReactNode } from "react";
import { NeutralToneMapping } from "three";

/** How far a lab reaches from its middle when it names no reach, in scene units. */
const DEFAULT_REACH = 5;

/** The places a lab can stand in, each with its own light and backdrop. */
const SETTINGS: Record<Place, ComponentType> = {
  cell: CellSetting,
  dark: DarkSetting,
  field: FieldSetting,
  lab: LabSetting,
  microscope: MicroscopeSetting,
  sky: SkySetting,
  space: SpaceSetting,
  studio: StudioSetting,
  water: WaterSetting,
};

/**
 * The stage every science lab stands on, in the place its subject belongs: a
 * teaching laboratory, the same laboratory darkened for beams and glowing
 * things, an open field, the open sky, a photo studio, or one of the places
 * with no floor at all: open water or cytoplasm at the scale of a molecule,
 * the crowded inside of a cell or its nucleus, the lit field of a
 * microscope, and open space. The place lights the lab, stands behind it,
 * moves slowly as it does in life, and sets where its key light and shadows
 * fall, and every lab is drawn through the same photographic finish. A lab
 * never draws a backdrop, a pedestal or a floor of its own. The canvas tone
 * maps with PBR Neutral, which the finish takes over while it draws.
 * A lab with a floor names its height. It stands on the ground of its place
 * (the epoxy bench of a laboratory, the grass of a field, the maple table of
 * a studio) unless it names another: open ground, which the stage draws as
 * far as the haze and rolls gently far from the lab, or a bench or table top
 * inside a room, which dissolves into the room behind it.
 *
 * @param setting - The place the lab stands in
 * @param reach - How far the lab reaches from its middle, which the key
 * light's shadows, the haze, and the focus cover
 * @param floor - The height of the floor objects stand on, when there is one
 * @param ground - What the lab stands on, when it is not the ground of its place
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
  readonly ground?: GroundKind;
  readonly reach?: number;
  readonly setting: Place;
}) {
  const Setting = SETTINGS[setting];

  return (
    <ThreeCanvas frameloop={frameloop} toneMapping={NeutralToneMapping}>
      <StageProvider
        animated={frameloop === "always"}
        floor={floor}
        ground={standsOn(setting, floor, ground)}
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
