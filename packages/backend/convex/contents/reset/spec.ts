import type { FunctionReference } from "convex/server";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const popularityResetTableValues = [
  "queue",
  "partitions",
  "viewers",
  "signals",
  "counters",
] as const;

export const popularityResetTableValidator = literals(
  ...popularityResetTableValues
);

export const startPopularityResetResultValidator = v.object({
  scheduled: v.boolean(),
  started: v.boolean(),
});

export const popularityResetPageArgs = {
  table: v.optional(popularityResetTableValidator),
};

export const popularityResetPageArgsValidator = v.object(
  popularityResetPageArgs
);

export const popularityResetPageResultValidator = v.object({
  deleted: v.number(),
  done: v.boolean(),
  table: v.union(popularityResetTableValidator, v.null()),
});

export const aggregatePopularityResetArgs = {
  cursor: v.optional(v.string()),
};

export const aggregatePopularityResetArgsValidator = v.object(
  aggregatePopularityResetArgs
);

export const aggregatePopularityResetResultValidator = v.object({
  cleared: v.number(),
  cursor: v.string(),
  isDone: v.boolean(),
});

export const verifyPopularityResetResultValidator = v.object({
  restarted: v.boolean(),
});

export const popularityResetReportValidator = v.object({
  aggregate: v.object({
    cleared: v.number(),
    empty: v.boolean(),
  }),
  complete: v.boolean(),
  resetting: v.boolean(),
  tables: v.object({
    countersEmpty: v.boolean(),
    partitionsEmpty: v.boolean(),
    queueEmpty: v.boolean(),
    signalsEmpty: v.boolean(),
    viewerSignalsEmpty: v.boolean(),
  }),
});

export type PopularityResetTable = Infer<typeof popularityResetTableValidator>;

export type StartPopularityResetResult = Infer<
  typeof startPopularityResetResultValidator
>;

export type PopularityResetPageArgs = Infer<
  typeof popularityResetPageArgsValidator
>;

export type PopularityResetPageResult = Infer<
  typeof popularityResetPageResultValidator
>;

export type AggregatePopularityResetArgs = Infer<
  typeof aggregatePopularityResetArgsValidator
>;

export type AggregatePopularityResetResult = Infer<
  typeof aggregatePopularityResetResultValidator
>;

export type VerifyPopularityResetResult = Infer<
  typeof verifyPopularityResetResultValidator
>;

export type PopularityResetReport = Infer<
  typeof popularityResetReportValidator
>;

export type PopularityResetPageReference = FunctionReference<
  "mutation",
  "internal",
  PopularityResetPageArgs,
  PopularityResetPageResult
>;

export type AggregatePopularityResetReference = FunctionReference<
  "mutation",
  "internal",
  AggregatePopularityResetArgs,
  AggregatePopularityResetResult
>;

export type VerifyPopularityResetReference = FunctionReference<
  "mutation",
  "internal",
  Record<string, never>,
  VerifyPopularityResetResult
>;
