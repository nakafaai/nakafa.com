import {
  createEffectSchema,
  providerCompatibleObjectSchema,
} from "@repo/ai/lib/effect-schema";
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
  MathProbabilityInputSchema,
  providerCompatibleObjectSchema(MathProbabilityInputSchema)
);
export const mathGeometryInput = createEffectSchema(
  MathGeometryInputSchema,
  providerCompatibleObjectSchema(MathGeometryInputSchema)
);
export const mathDiscreteInput = createEffectSchema(
  MathDiscreteInputSchema,
  providerCompatibleObjectSchema(MathDiscreteInputSchema)
);
