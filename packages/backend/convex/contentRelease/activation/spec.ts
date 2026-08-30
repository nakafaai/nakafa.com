import { publicationReceiptValidator } from "@repo/backend/convex/contentRelease/spec";
import { type Infer, v } from "convex/values";

export const activationResultValidator = v.union(
  v.object({
    kind: v.literal("activated"),
    receipt: publicationReceiptValidator,
  }),
  v.object({
    kind: v.literal("completed"),
    receipt: publicationReceiptValidator,
  })
);

export type ActivationResult = Infer<typeof activationResultValidator>;

export const preparationResultValidator = v.union(
  v.object({ kind: v.literal("completed") }),
  v.object({ kind: v.literal("prepared") })
);

export type PreparationResult = Infer<typeof preparationResultValidator>;
