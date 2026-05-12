import {
  createEffectSchema,
  providerCompatibleObjectSchema,
} from "@repo/ai/lib/effect-schema";
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
export const mathAlgebraInput = createEffectSchema(
  MathAlgebraInputSchema,
  providerCompatibleObjectSchema(MathAlgebraInputSchema)
);
export const mathEquationInput = createEffectSchema(
  MathEquationInputSchema,
  providerCompatibleObjectSchema(MathEquationInputSchema)
);
export const mathCalculusInput = createEffectSchema(MathCalculusInputSchema);
export const mathSeriesInput = createEffectSchema(
  MathSeriesInputSchema,
  providerCompatibleObjectSchema(MathSeriesInputSchema)
);
export const mathMatrixInput = createEffectSchema(
  MathMatrixInputSchema,
  providerCompatibleObjectSchema(MathMatrixInputSchema)
);
export const mathStatisticsInput = createEffectSchema(
  MathStatisticsInputSchema,
  providerCompatibleObjectSchema(MathStatisticsInputSchema)
);
export const mathProbabilityInput = createEffectSchema(
  MathProbabilityInputSchema
);
export const mathGeometryInput = createEffectSchema(
  MathGeometryInputSchema,
  providerCompatibleObjectSchema(MathGeometryInputSchema)
);
export const mathDiscreteInput = createEffectSchema(
  MathDiscreteInputSchema,
  providerCompatibleObjectSchema(MathDiscreteInputSchema)
);
