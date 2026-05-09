import * as z from "zod";

export const MathKindSchema = z.enum([
  "evaluate",
  "simplify",
  "differentiate",
  "compare",
]);

export const MathConfidenceSchema = z.enum([
  "verified",
  "contradicted",
  "inconclusive",
]);

export const MathExpressionSchema = z.object({
  expression: z.string(),
  latex: z.string(),
});

export const MathEvaluateInputSchema = z.object({
  expression: z.string().min(1),
});

export const MathSimplifyInputSchema = z.object({
  expression: z.string().min(1),
});

export const MathDifferentiateInputSchema = z.object({
  expression: z.string().min(1),
  variable: z.string().min(1),
});

export const MathCompareInputSchema = z.object({
  left: z.string().min(1),
  right: z.string().min(1),
});

export const MathSampleSchema = z.object({
  left: z.string(),
  right: z.string(),
  scope: z.record(z.string(), z.number()),
});

export const MathEvaluateResultSchema = z.object({
  input: MathExpressionSchema,
  output: MathExpressionSchema.extend({
    value: z.string(),
  }),
});

export const MathSimplifyResultSchema = z.object({
  input: MathExpressionSchema,
  output: MathExpressionSchema,
});

export const MathDifferentiateResultSchema = z.object({
  input: MathExpressionSchema,
  output: MathExpressionSchema,
  variable: z.string(),
});

export const MathCompareResultSchema = z.object({
  left: MathExpressionSchema,
  reason: z.string(),
  right: MathExpressionSchema,
  samples: z.array(MathSampleSchema),
  status: MathConfidenceSchema,
});

const evaluateLoadingSchema = z.object({
  kind: z.literal("evaluate"),
  status: z.literal("loading"),
  input: MathEvaluateInputSchema,
});

const simplifyLoadingSchema = z.object({
  kind: z.literal("simplify"),
  status: z.literal("loading"),
  input: MathSimplifyInputSchema,
});

const differentiateLoadingSchema = z.object({
  kind: z.literal("differentiate"),
  status: z.literal("loading"),
  input: MathDifferentiateInputSchema,
});

const compareLoadingSchema = z.object({
  kind: z.literal("compare"),
  status: z.literal("loading"),
  input: MathCompareInputSchema,
});

export const MathDataSchema = z.union([
  evaluateLoadingSchema,
  evaluateLoadingSchema.extend({
    result: MathEvaluateResultSchema,
    status: z.literal("verified"),
    summary: z.string(),
  }),
  evaluateLoadingSchema.extend({
    error: z.string(),
    status: z.literal("error"),
  }),
  simplifyLoadingSchema,
  simplifyLoadingSchema.extend({
    result: MathSimplifyResultSchema,
    status: z.literal("verified"),
    summary: z.string(),
  }),
  simplifyLoadingSchema.extend({
    error: z.string(),
    status: z.literal("error"),
  }),
  differentiateLoadingSchema,
  differentiateLoadingSchema.extend({
    result: MathDifferentiateResultSchema,
    status: z.literal("verified"),
    summary: z.string(),
  }),
  differentiateLoadingSchema.extend({
    error: z.string(),
    status: z.literal("error"),
  }),
  compareLoadingSchema,
  compareLoadingSchema.extend({
    result: MathCompareResultSchema,
    status: MathConfidenceSchema,
    summary: z.string(),
  }),
  compareLoadingSchema.extend({
    error: z.string(),
    status: z.literal("error"),
  }),
]);

export type MathData = z.infer<typeof MathDataSchema>;
export type MathEvaluateInput = z.infer<typeof MathEvaluateInputSchema>;
export type MathEvaluateResult = z.infer<typeof MathEvaluateResultSchema>;
export type MathSimplifyInput = z.infer<typeof MathSimplifyInputSchema>;
export type MathSimplifyResult = z.infer<typeof MathSimplifyResultSchema>;
export type MathDifferentiateInput = z.infer<
  typeof MathDifferentiateInputSchema
>;
export type MathDifferentiateResult = z.infer<
  typeof MathDifferentiateResultSchema
>;
export type MathCompareInput = z.infer<typeof MathCompareInputSchema>;
export type MathCompareResult = z.infer<typeof MathCompareResultSchema>;
