import { providerCompatibleObjectSchema } from "@repo/backend/confect/nina/contract/provider";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import { MathAlgebraInputSchema } from "@repo/math/schema/tool/algebra";
import { MathArithmeticInputSchema } from "@repo/math/schema/tool/arithmetic";
import { MathCalculusInputSchema } from "@repo/math/schema/tool/calculus";
import { MathDiscreteInputSchema } from "@repo/math/schema/tool/discrete";
import { MathEquationInputSchema } from "@repo/math/schema/tool/equation";
import { MathGeometryInputSchema } from "@repo/math/schema/tool/geometry";
import { MathMatrixInputSchema } from "@repo/math/schema/tool/matrix";
import { MathProbabilityInputSchema } from "@repo/math/schema/tool/probability";
import { MathSeriesInputSchema } from "@repo/math/schema/tool/series";
import { MathStatisticsInputSchema } from "@repo/math/schema/tool/statistics";
import { Result } from "effect";

export const mathArithmeticInput = createEffectSchema(
  MathArithmeticInputSchema
);
export const mathAlgebraInput = createEffectSchema(
  MathAlgebraInputSchema,
  Result.getOrThrow(providerCompatibleObjectSchema(MathAlgebraInputSchema))
);
export const mathEquationInput = createEffectSchema(
  MathEquationInputSchema,
  Result.getOrThrow(providerCompatibleObjectSchema(MathEquationInputSchema))
);
export const mathCalculusInput = createEffectSchema(MathCalculusInputSchema);
export const mathSeriesInput = createEffectSchema(
  MathSeriesInputSchema,
  Result.getOrThrow(providerCompatibleObjectSchema(MathSeriesInputSchema))
);
export const mathMatrixInput = createEffectSchema(
  MathMatrixInputSchema,
  Result.getOrThrow(providerCompatibleObjectSchema(MathMatrixInputSchema))
);
export const mathStatisticsInput = createEffectSchema(
  MathStatisticsInputSchema,
  Result.getOrThrow(providerCompatibleObjectSchema(MathStatisticsInputSchema))
);
export const mathProbabilityInput = createEffectSchema(
  MathProbabilityInputSchema,
  Result.getOrThrow(providerCompatibleObjectSchema(MathProbabilityInputSchema))
);
export const mathGeometryInput = createEffectSchema(
  MathGeometryInputSchema,
  Result.getOrThrow(providerCompatibleObjectSchema(MathGeometryInputSchema))
);
export const mathDiscreteInput = createEffectSchema(
  MathDiscreteInputSchema,
  Result.getOrThrow(providerCompatibleObjectSchema(MathDiscreteInputSchema))
);
