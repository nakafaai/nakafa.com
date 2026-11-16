import { useThree } from "@react-three/fiber";
import type { GroundSchema } from "@repo/design-system/components/three/stage/grain";
import {
  isMobileDevice,
  isSoftwareRenderer,
} from "@repo/design-system/lib/device";
import { Schema } from "effect";
import { createContext, type ReactNode, use, useMemo } from "react";
import type { WebGLRenderer } from "three";

/**
 * How much of the stage a device can afford. `full` draws the whole finish
 * with the sharp environment files; `light`, on a phone, keeps the occlusion
 * and the grade and loads the half-size files; `plain`, on a renderer that
 * draws on the CPU, draws no finish at all, because each full-screen pass
 * there costs a frame many times over.
 */
const StageTierSchema = Schema.Literals(["full", "light", "plain"]);

interface StageProviderProps {
  readonly children: ReactNode;
  /** The height of the floor objects stand on, when the lab has one. */
  readonly floor: number | undefined;
  /** What the ground is made of, when the lab stands on real ground. */
  readonly ground: typeof GroundSchema.Type | undefined;
  /** How far the lab reaches from its middle, in scene units. */
  readonly reach: number;
  /** The unit direction toward the setting's sun. */
  readonly sun: readonly [x: number, y: number, z: number];
}

/** What every part of a stage reads: the lab's floor and reach, and its tier. */
type StageValue = Omit<StageProviderProps, "children"> &
  Readonly<Record<"tier", typeof StageTierSchema.Type>>;

const StageContext = createContext<StageValue | null>(null);

/** Reads the name of the GPU, or of the rasterizer, that draws the canvas. */
function rendererName(gl: WebGLRenderer) {
  const context = gl.getContext();
  const info = context.getExtension("WEBGL_debug_renderer_info");
  return String(
    context.getParameter(
      info === null ? context.RENDERER : info.UNMASKED_RENDERER_WEBGL
    )
  );
}

/** Picks the tier from the renderer first, then from the kind of device. */
function stageTier(gl: WebGLRenderer): typeof StageTierSchema.Type {
  if (isSoftwareRenderer(rendererName(gl))) {
    return "plain";
  }
  return isMobileDevice() ? "light" : "full";
}

/**
 * Shares the floor, reach, and tier of one lab with the parts of its stage. It
 * renders inside the canvas, which mounts only in the browser, so reading the
 * device and the renderer never reaches streamed server HTML.
 */
export function StageProvider({
  children,
  floor,
  ground,
  reach,
  sun,
}: StageProviderProps) {
  const gl = useThree((state) => state.gl);
  const value = useMemo(
    () => ({ floor, ground, reach, sun, tier: stageTier(gl) }),
    [floor, gl, ground, reach, sun]
  );

  return <StageContext value={value}>{children}</StageContext>;
}

/** Reads the floor, reach, and tier of the surrounding stage. */
export function useStage() {
  const stage = use(StageContext);
  if (!stage) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error("useStage must be used within StageProvider");
  }
  return stage;
}
