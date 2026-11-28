import { useThree } from "@react-three/fiber";
import { usePostprocessingDegraded } from "@repo/design-system/components/three/guard";
import { openAir } from "@repo/design-system/components/three/sky/air";
import { filmed } from "@repo/design-system/components/three/sky/tone";
import type { Ground } from "@repo/design-system/components/three/stage/land";
import type { Place } from "@repo/design-system/components/three/stage/place";
import type { StageBudget } from "@repo/design-system/components/three/stage/tier";
import {
  resolveStageProfile,
  resolveStageTier,
} from "@repo/design-system/components/three/stage/tier";
import { useRequired } from "@repo/design-system/hooks/required";
import {
  isLowEndDevice,
  isMobileDevice,
  supportsHalfFloatColorBuffer,
} from "@repo/design-system/lib/device";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import type { ReactNode } from "react";
import { createContext, use, useMemo } from "react";
import type { WebGLRenderer } from "three";
import { Color, LinearSRGBColorSpace } from "three";

interface StageProviderProps {
  /** Whether this stage animates continuously (`frameloop="always"`). */
  readonly animated?: boolean;
  readonly children: ReactNode;
  /** The height of the floor objects stand on, when the lab has one. */
  readonly floor: number | undefined;
  /** What the ground is made of, when the lab stands on real ground. */
  readonly ground: Ground | undefined;
  /** The place the lab stands in, when it is one of the stage's places. */
  readonly place?: Place | undefined;
  /** How far the lab reaches from its middle, in scene units. */
  readonly reach: number;
  /** The unit direction toward the setting's sun. */
  readonly sun: readonly [x: number, y: number, z: number];
}

/**
 * What every part of a stage reads: the lab's floor, reach, tier, and
 * resolved profile, the direction toward its sun, and under the open sky
 * the air of the place and the colour the far distance fades into.
 */
type StageValue = Omit<StageProviderProps, "animated" | "children"> &
  StageBudget &
  Readonly<Record<"animated", boolean>> &
  Readonly<Record<"air", ReturnType<typeof openAir>>> &
  Readonly<Record<"haze", Color | undefined>>;

const StageContext = createContext<StageValue | null>(null);

/** Reads the name of the GPU, or of the rasterizer, that draws the canvas. */
function rendererName(gl: WebGLRenderer): string {
  const context = gl.getContext();
  const info = context.getExtension("WEBGL_debug_renderer_info");
  return String(
    context.getParameter(
      info === null ? context.RENDERER : info.UNMASKED_RENDERER_WEBGL
    )
  );
}

/** Reads whether the page shows its dark theme, which turns day into night and dims a backdrop. */
export function useDark() {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  return getThemeAppearance(resolvedTheme) === "dark";
}

/** Measures renderer and device capabilities once to resolve tier and budget. */
function measureStageBudget(gl: WebGLRenderer): StageBudget {
  const context = gl.getContext();
  const isWebGL2 = gl.capabilities.isWebGL2;
  const supportsHalfFloat = supportsHalfFloatColorBuffer(context, isWebGL2);
  const tier = resolveStageTier({
    isWebGL2,
    lowEnd: isLowEndDevice(),
    mobile: isMobileDevice(),
    renderer: rendererName(gl),
    supportsHalfFloat,
  });
  return {
    profile: resolveStageProfile(tier, supportsHalfFloat),
    tier,
  };
}

/**
 * Shares the floor, reach, tier, and rendering profile of one lab with the
 * parts of its stage, and what its sky gives everything under it: `sun`,
 * the unit direction toward the sun (the moon at night), `air`, the light
 * and tones of the open sky, and `haze`, the colour the far distance fades
 * into, ready to be mixed in as fog is. A place with no open sky has no air
 * and no haze here. The haze is mixed in after the film curve when the
 * canvas draws directly, so it is passed through that curve first. It
 * renders inside the canvas, which mounts only in the browser, so reading
 * the device and renderer never reaches streamed server HTML.
 */
export function StageProvider({
  animated = false,
  children,
  floor,
  ground,
  place,
  reach,
  sun,
}: StageProviderProps) {
  const gl = useThree((state) => state.gl);
  const dark = useDark();
  const degraded = usePostprocessingDegraded();
  const value = useMemo(() => {
    const { profile, tier } = measureStageBudget(gl);
    const air = openAir(place, sun, dark);
    const finished = profile.postprocessing && !degraded;
    const haze =
      air === undefined
        ? undefined
        : new Color().setRGB(
            ...(finished ? air.haze : filmed(air.haze)),
            LinearSRGBColorSpace
          );
    return {
      air,
      animated,
      floor,
      ground,
      haze,
      place,
      profile,
      reach,
      sun,
      tier,
    };
  }, [animated, dark, degraded, floor, gl, ground, place, reach, sun]);

  return <StageContext value={value}>{children}</StageContext>;
}

/** Reads the floor, reach, tier, and profile of the surrounding stage. */
export function useStage() {
  return useRequired(StageContext, "useStage");
}

/**
 * Whether the surrounding stage draws on a capable desktop card, which can
 * afford to trace light through a surface. A part drawn outside any stage
 * gets the cheaper look.
 */
export function useDeepLight() {
  return use(StageContext)?.tier === "full";
}
