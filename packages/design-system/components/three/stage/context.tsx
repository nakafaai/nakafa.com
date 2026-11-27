import { useThree } from "@react-three/fiber";
import type { Ground } from "@repo/design-system/components/three/stage/land";
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
import type { ReactNode } from "react";
import { createContext, useMemo } from "react";
import type { WebGLRenderer } from "three";

interface StageProviderProps {
  /** Whether this stage animates continuously (`frameloop="always"`). */
  readonly animated?: boolean;
  readonly children: ReactNode;
  /** The height of the floor objects stand on, when the lab has one. */
  readonly floor: number | undefined;
  /** What the ground is made of, when the lab stands on real ground. */
  readonly ground: Ground | undefined;
  /** How far the lab reaches from its middle, in scene units. */
  readonly reach: number;
  /** The unit direction toward the setting's sun. */
  readonly sun: readonly [x: number, y: number, z: number];
}

/** What every part of a stage reads: the lab's floor, reach, tier, and resolved profile. */
type StageValue = Omit<StageProviderProps, "animated" | "children"> &
  StageBudget &
  Readonly<Record<"animated", boolean>>;

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
 * parts of its stage. It renders inside the canvas, which mounts only in the
 * browser, so reading the device and renderer never reaches streamed server HTML.
 */
export function StageProvider({
  animated = false,
  children,
  floor,
  ground,
  reach,
  sun,
}: StageProviderProps) {
  const gl = useThree((state) => state.gl);
  const value = useMemo(() => {
    const { profile, tier } = measureStageBudget(gl);
    return { animated, floor, ground, profile, reach, sun, tier };
  }, [animated, floor, gl, ground, reach, sun]);

  return <StageContext value={value}>{children}</StageContext>;
}

/** Reads the floor, reach, tier, and profile of the surrounding stage. */
export function useStage() {
  return useRequired(StageContext, "useStage");
}
