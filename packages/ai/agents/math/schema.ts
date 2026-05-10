import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import {
  MathAlgebraInputSchema,
  MathArithmeticInputSchema,
  MathCalculusInputSchema,
  MathDiscreteInputSchema,
  MathEquationInputSchema,
  MathGeometryInputSchema,
  MathMatrixInputSchema,
  MathProbabilityInputSchema,
  MathSeriesInputSchema,
  MathStatisticsInputSchema,
} from "@repo/math/schema";

export const mathArithmeticInput = createEffectSchema(
  MathArithmeticInputSchema
);
export const mathAlgebraInput = createEffectSchema(MathAlgebraInputSchema);
export const mathEquationInput = createEffectSchema(MathEquationInputSchema);
export const mathCalculusInput = createEffectSchema(MathCalculusInputSchema);
export const mathSeriesInput = createEffectSchema(MathSeriesInputSchema);
export const mathMatrixInput = createEffectSchema(MathMatrixInputSchema);
export const mathStatisticsInput = createEffectSchema(
  MathStatisticsInputSchema
);
export const mathProbabilityInput = createEffectSchema(
  MathProbabilityInputSchema
);
export const mathGeometryInput = createEffectSchema(MathGeometryInputSchema);
export const mathDiscreteInput = createEffectSchema(MathDiscreteInputSchema);
