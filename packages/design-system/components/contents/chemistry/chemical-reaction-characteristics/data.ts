import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { Schema } from "effect";

export const GAS_CUE_ID = "gas";
export const PRECIPITATE_CUE_ID = "precipitate";
export const COLOR_CUE_ID = "color";
export const ENERGY_CUE_ID = "energy";

export const REACTION_CUE_IDS = [
  GAS_CUE_ID,
  PRECIPITATE_CUE_ID,
  COLOR_CUE_ID,
  ENERGY_CUE_ID,
] as const;

export type ReactionCueId = (typeof REACTION_CUE_IDS)[number];
export type ReactionSceneColors = ReturnType<typeof getReactionSceneColors>;
export const ReactionScenePointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);

type ReactionScenePoint = typeof ReactionScenePointSchema.Type;

const ReactionCueSchema = Schema.Struct({
  kind: Schema.Literals(REACTION_CUE_IDS),
});

const REACTION_CUES = {
  [GAS_CUE_ID]: {
    kind: GAS_CUE_ID,
  },
  [PRECIPITATE_CUE_ID]: {
    kind: PRECIPITATE_CUE_ID,
  },
  [COLOR_CUE_ID]: {
    kind: COLOR_CUE_ID,
  },
  [ENERGY_CUE_ID]: {
    kind: ENERGY_CUE_ID,
  },
} satisfies Record<ReactionCueId, typeof ReactionCueSchema.Type>;

export const REACTION_SCENE_VIEW = {
  cameraPosition: [0, 2.2, 4.2],
  cameraTarget: [0, 0.05, 0],
  narrowCameraPosition: [0, 2.65, 4.75],
} satisfies Record<string, ReactionScenePoint>;

/**
 * Narrows ToggleGroup string values to the available reaction cue IDs.
 */
export function isReactionCueId(value: string): value is ReactionCueId {
  return value in REACTION_CUES;
}

/**
 * Chooses theme-aware colors for the 3D reaction clue scene.
 */
export function getReactionSceneColors(resolvedTheme: string | undefined) {
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";

  return {
    arrow: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    bubble: PLOT_COLORS.teal,
    glass: getColor("SLATE", 300),
    groundLight: isDarkTheme ? PLOT_COLORS.slate : getColor("STONE"),
    heat: PLOT_COLORS.orange,
    liquidAfterColor: PLOT_COLORS.amber,
    liquidBase: isDarkTheme ? PLOT_COLORS.slate : getColor("GRAY"),
    liquidGas: PLOT_COLORS.violet,
    liquidWarm: PLOT_COLORS.orange,
    precipitate: PLOT_COLORS.fuchsia,
    skyLight: ORIGIN_COLOR.LIGHT,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}
