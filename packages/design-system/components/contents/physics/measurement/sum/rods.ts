import { resolve } from "@repo/design-system/components/contents/physics/measurement/figures";
import { Schema } from "effect";

/**
 * Two rods laid end to end. The iron rod is read with a vernier caliper that
 * resolves 0.005 cm; the copper rod is read either with a steel ruler that
 * resolves 0.1 cm or with the same caliper. The joined length is the sum,
 * and it can only be trusted to the decimal place of the coarser reading:
 * the ruler leaves the copper rod's end anywhere in a band 0.1 cm wide.
 */

/** The iron rod's true length, in centimetres. */
export const IRON_LENGTH = 8.2352;

/** The copper rod's true length, in centimetres. */
export const COPPER_LENGTH = 4.4984;

/** The caliper's resolution, in centimetres. */
export const CALIPER_STEP = 0.005;

/** The instruments the copper rod can be read with, by the step each resolves, in centimetres. */
export const CopperToolSchema = Schema.Literals(["ruler", "caliper"]);
export const COPPER_TOOLS = {
  caliper: CALIPER_STEP,
  ruler: 0.1,
} as const satisfies Record<typeof CopperToolSchema.Type, number>;

/** How many decimals a reading resolved to `step` centimetres is written with. */
function decimalsOf(step: number) {
  return Math.ceil(-Math.log10(step) - 1e-9);
}

/**
 * Both readings, their raw sum, and the sum rounded to the fewest decimals
 * of the two, with how far either way the joined end may really lie.
 */
export function joinedRods(tool: typeof CopperToolSchema.Type) {
  const step = COPPER_TOOLS[tool];
  const iron = resolve(IRON_LENGTH, CALIPER_STEP);
  const copper = resolve(COPPER_LENGTH, step);
  const ironDecimals = decimalsOf(CALIPER_STEP);
  const copperDecimals = decimalsOf(step);
  const decimals = Math.min(ironDecimals, copperDecimals);
  const raw = iron + copper;
  const scale = 10 ** decimals;
  return {
    copper,
    copperDecimals,
    decimals,
    iron,
    ironDecimals,
    raw,
    reported: Math.round(raw * scale) / scale,
    spread: (CALIPER_STEP + step) / 2,
  };
}
