import { isSoftwareRenderer } from "@repo/design-system/lib/device";
import { Match, Schema } from "effect";

/**
 * Rendering tier for a science stage:
 * - `full`: capable desktop GPU with WebGL2 and half-float support (full postprocessing, 2048 shadows, desktop HDRI)
 * - `light`: capable mobile/tablet GPU (direct PBR Neutral, 2048 shadows, desktop HDRI for crisp reflections)
 * - `low`: low-end / memory-constrained device (direct PBR Neutral, 1024 shadows, phone HDRI)
 * - `plain`: CPU software rasterizer or missing WebGL2/half-float support (direct PBR Neutral, 1024 shadows)
 */
const StageTierSchema = Schema.Literals(["full", "light", "low", "plain"]);
type StageTier = typeof StageTierSchema.Type;

/** Hardware and WebGL capabilities measured once per stage renderer. */
const StageCapabilitiesSchema = Schema.Struct({
  isWebGL2: Schema.Boolean,
  lowEnd: Schema.Boolean,
  mobile: Schema.Boolean,
  renderer: Schema.String,
  supportsHalfFloat: Schema.Boolean,
});
type StageCapabilities = typeof StageCapabilitiesSchema.Type;

/**
 * Concrete rendering budget derived from a stage tier and half-float
 * capability. Rolling ground is meshed in `landRings` rings of `landSpokes`
 * vertices each, and whatever lies on it far from the lab bends as finely.
 */
const StageProfileSchema = Schema.Struct({
  environmentDirectory: Schema.Literals(["desktop", "phone"]),
  landRings: Schema.Finite,
  landSpokes: Schema.Finite,
  postprocessing: Schema.Boolean,
  shadowMapSize: Schema.Finite,
  shadowRadius: Schema.Finite,
  useExrEnvironment: Schema.Boolean,
});
type StageProfile = typeof StageProfileSchema.Type;

/** Measured stage tier paired with its derived rendering profile. */
const StageBudgetSchema = Schema.Struct({
  profile: StageProfileSchema,
  tier: StageTierSchema,
});
export type StageBudget = typeof StageBudgetSchema.Type;

/** Picks the stage rendering tier from WebGL capabilities and device class. */
export function resolveStageTier(capabilities: StageCapabilities): StageTier {
  if (
    isSoftwareRenderer(capabilities.renderer) ||
    !capabilities.isWebGL2 ||
    !capabilities.supportsHalfFloat
  ) {
    return "plain";
  }
  if (capabilities.lowEnd) {
    return "low";
  }
  if (capabilities.mobile) {
    return "light";
  }
  return "full";
}

/** Derives concrete shadow, environment, and postprocessing settings for one stage tier. */
export function resolveStageProfile(
  tier: StageTier,
  supportsHalfFloat: boolean
): StageProfile {
  return Match.value(tier).pipe(
    Match.when("full", () => ({
      environmentDirectory: "desktop" as const,
      landRings: 48,
      landSpokes: 96,
      postprocessing: supportsHalfFloat,
      shadowMapSize: 2048,
      shadowRadius: 4,
      useExrEnvironment: supportsHalfFloat,
    })),
    Match.when("light", () => ({
      environmentDirectory: "desktop" as const,
      landRings: 40,
      landSpokes: 80,
      postprocessing: false,
      shadowMapSize: 2048,
      shadowRadius: 3,
      useExrEnvironment: supportsHalfFloat,
    })),
    Match.when("low", () => ({
      environmentDirectory: "phone" as const,
      landRings: 28,
      landSpokes: 64,
      postprocessing: false,
      shadowMapSize: 1024,
      shadowRadius: 2,
      useExrEnvironment: supportsHalfFloat,
    })),
    Match.when("plain", () => ({
      environmentDirectory: "phone" as const,
      landRings: 20,
      landSpokes: 48,
      postprocessing: false,
      shadowMapSize: 1024,
      shadowRadius: 2,
      useExrEnvironment: supportsHalfFloat,
    })),
    Match.exhaustive
  );
}
