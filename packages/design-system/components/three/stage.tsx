import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { OpenSetting } from "@repo/design-system/components/three/sky/open";
import { StageProvider } from "@repo/design-system/components/three/stage/context";
import { Finish } from "@repo/design-system/components/three/stage/finish";
import { Ground } from "@repo/design-system/components/three/stage/ground";
import {
  CellSetting,
  MicroscopeSetting,
  WaterSetting,
} from "@repo/design-system/components/three/stage/medium";
import type {
  Place,
  Stand,
} from "@repo/design-system/components/three/stage/place";
import { standsOn } from "@repo/design-system/components/three/stage/place";
import {
  DarkSetting,
  LabSetting,
  SETTING_SUNS,
  SpaceSetting,
  StudioSetting,
} from "@repo/design-system/components/three/stage/settings";
import type { ComponentType, ReactNode } from "react";
import { ACESFilmicToneMapping } from "three";

/** How far a lab reaches from its middle when it names no reach, in scene units. */
const DEFAULT_REACH = 5;

/** The places a lab can stand in, each with its own light and backdrop. */
const SETTINGS: Record<Place, ComponentType> = {
  cell: CellSetting,
  dark: DarkSetting,
  field: OpenSetting,
  lab: LabSetting,
  microscope: MicroscopeSetting,
  sky: OpenSetting,
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
 * never draws a backdrop, a pedestal or a floor of its own. Under the open
 * sky (a field, the sky over the sea) the stage draws the sky itself, a
 * clear day on a light page and a moonlit dusk on a dark one, and lights
 * the lab from it. The canvas passes every lab through one film curve, ACES
 * filmic, at one exposure, which the finish takes over while it draws.
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
 * @param ground - What the lab stands on, when it is not the ground of its
 * place, or `cut` for a lab that is itself a block cut out of the ground
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
  readonly ground?: Stand;
  readonly reach?: number;
  readonly setting: Place;
}) {
  const Setting = SETTINGS[setting];

  return (
    <ThreeCanvas frameloop={frameloop} toneMapping={ACESFilmicToneMapping}>
      <StageProvider
        animated={frameloop === "always"}
        floor={floor}
        ground={standsOn(setting, floor, ground)}
        place={setting}
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
