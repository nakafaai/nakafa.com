import {
  mathComputationValidator,
  mathOperationValidator,
  mathPedagogyProjectionValidator,
  mathStatusValidator,
  mathWorkArtifactValidator,
  mathWorkStepValidator,
  mathWorkValidator,
} from "@repo/backend/convex/math/spec";
import { defineTable, paginationResultValidator } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { addFieldsToValidator, systemFields } from "convex-helpers/validators";

/** Normalized root row for one MathWork result. */
export const mathWorkRowValidator = v.object({
  ...mathWorkValidator.fields,
  chatId: v.id("chats"),
  responseMessageIdentifier: v.optional(v.string()),
  toolCallId: v.optional(v.string()),
  userId: v.id("users"),
});

/** Normalized computation row for one MathWork result. */
export const mathComputationRowValidator = v.object({
  chatId: v.id("chats"),
  computation: mathComputationValidator,
  operation: mathOperationValidator,
  order: v.number(),
  status: mathStatusValidator,
  userId: v.id("users"),
  workId: v.string(),
});

/** Normalized derivation step row for paginated reads. */
export const mathWorkStepRowValidator = v.object({
  ...mathWorkStepValidator.fields,
  chatId: v.id("chats"),
  userId: v.id("users"),
});

/** Normalized render artifact row for compact UI projection. */
export const mathWorkArtifactRowValidator = v.object({
  ...mathWorkArtifactValidator.fields,
  chatId: v.id("chats"),
  userId: v.id("users"),
});

/** Non-canonical live narration row generated from deterministic MathWork. */
export const mathPedagogyProjectionRowValidator = v.object({
  chatId: v.id("chats"),
  evidenceHash: v.string(),
  modelId: v.string(),
  projection: mathPedagogyProjectionValidator,
  promptVersion: v.string(),
  responseMessageIdentifier: v.optional(v.string()),
  schemaVersion: v.string(),
  toolCallId: v.optional(v.string()),
  userId: v.id("users"),
  workId: v.string(),
});

/** Paginated read-model validator for MathWork derivation step rows. */
export const paginatedMathWorkStepsValidator = paginationResultValidator(
  addFieldsToValidator(mathWorkStepRowValidator, systemFields("mathWorkSteps"))
);

export type MathWorkRow = Infer<typeof mathWorkRowValidator>;
export type MathWorkStepRow = Infer<typeof mathWorkStepRowValidator>;

const tables = {
  mathWorks: defineTable(mathWorkRowValidator)
    .index("by_chatId", ["chatId"])
    .index("by_chatId_and_workId", ["chatId", "workId"])
    .index("by_chatId_and_responseMessageIdentifier", [
      "chatId",
      "responseMessageIdentifier",
    ])
    .index("by_userId", ["userId"]),
  mathComputations: defineTable(mathComputationRowValidator)
    .index("by_workId_and_order", ["workId", "order"])
    .index("by_chatId_and_workId_and_order", ["chatId", "workId", "order"]),
  mathWorkSteps: defineTable(mathWorkStepRowValidator)
    .index("by_workId_and_order", ["workId", "order"])
    .index("by_chatId_and_workId_and_order", ["chatId", "workId", "order"]),
  mathWorkArtifacts: defineTable(mathWorkArtifactRowValidator)
    .index("by_workId_and_kind", ["workId", "kind"])
    .index("by_chatId_and_workId_and_kind", ["chatId", "workId", "kind"]),
  mathPedagogyProjections: defineTable(mathPedagogyProjectionRowValidator)
    .index("by_chatId_and_workId", ["chatId", "workId"])
    .index("by_chatId_and_responseMessageIdentifier", [
      "chatId",
      "responseMessageIdentifier",
    ]),
};

export default tables;
