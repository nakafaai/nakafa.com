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
import { Schema } from "effect";

export const MathToolInputSchema = Schema.Union(
  MathArithmeticInputSchema,
  MathAlgebraInputSchema,
  MathEquationInputSchema,
  MathGeometryInputSchema,
  MathDiscreteInputSchema,
  MathMatrixInputSchema,
  MathSeriesInputSchema,
  MathStatisticsInputSchema,
  MathProbabilityInputSchema,
  MathCalculusInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Strict math tool input shape accepted before deterministic math evidence is requested.",
  });

export type MathToolInput = Schema.Schema.Type<typeof MathToolInputSchema>;
