import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { verifyChatOwnership } from "@repo/backend/convex/chats/helpers";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { mathWorkResultValidator } from "@repo/backend/convex/math/spec";
import { ConvexError, type Infer, v } from "convex/values";

const MAX_MATH_WORK_CHILD_ROWS = 100;
type MathWorkResultInput = Infer<typeof mathWorkResultValidator>;
type MathChildId =
  | Doc<"mathComputations">["_id"]
  | Doc<"mathWorkArtifacts">["_id"]
  | Doc<"mathWorkSteps">["_id"];

/** Saves one canonical MathWork result into normalized, indexed rows. */
export const save = mutation({
  args: {
    chatId: vv.id("chats"),
    responseMessageIdentifier: v.optional(v.string()),
    result: mathWorkResultValidator,
    toolCallId: v.optional(v.string()),
  },
  returns: v.object({
    artifactCount: v.number(),
    computationCount: v.number(),
    stepCount: v.number(),
    workId: v.string(),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const { chatId, result } = args;

    await verifyChatOwnership(ctx, chatId, appUser._id);
    assertBoundedMathWork(result);
    await deleteExistingMathWork(ctx, chatId, result.work.workId);

    await ctx.db.insert("mathWorks", {
      assumptions: result.work.assumptions,
      chatId,
      createdAt: result.work.createdAt,
      input: result.work.input,
      limitations: result.work.limitations,
      plannedRequest: result.work.plannedRequest,
      primaryResult: result.work.primaryResult,
      ...(args.responseMessageIdentifier
        ? { responseMessageIdentifier: args.responseMessageIdentifier }
        : {}),
      status: result.work.status,
      ...(args.toolCallId ? { toolCallId: args.toolCallId } : {}),
      userId: appUser._id,
      verification: result.work.verification,
      workId: result.work.workId,
    });

    await insertComputations(ctx, chatId, appUser._id, result);
    await insertSteps(ctx, chatId, appUser._id, result);
    await insertArtifacts(ctx, chatId, appUser._id, result);

    return {
      artifactCount: result.artifacts.length,
      computationCount: result.work.computations.length,
      stepCount: result.steps.length,
      workId: result.work.workId,
    };
  },
});

/** Rejects oversized MathWork writes before mutation rows are partially inserted. */
function assertBoundedMathWork(result: MathWorkResultInput) {
  if (
    result.work.computations.length > MAX_MATH_WORK_CHILD_ROWS ||
    result.steps.length > MAX_MATH_WORK_CHILD_ROWS ||
    result.artifacts.length > MAX_MATH_WORK_CHILD_ROWS
  ) {
    throw new ConvexError({
      code: "MATH_WORK_TOO_LARGE",
      message: "MathWork exceeded the supported normalized row limit.",
    });
  }
}

/** Deletes the existing normalized rows for one work id using indexed batches. */
async function deleteExistingMathWork(
  ctx: MutationCtx,
  chatId: Doc<"chats">["_id"],
  workId: string
) {
  const existing = await ctx.db
    .query("mathWorks")
    .withIndex("by_chatId_and_workId", (q) =>
      q.eq("chatId", chatId).eq("workId", workId)
    )
    .unique();

  if (!existing) {
    return;
  }

  await deleteComputations(ctx, chatId, workId);
  await deleteSteps(ctx, chatId, workId);
  await deleteArtifacts(ctx, chatId, workId);
  await ctx.db.delete(existing._id);
}

/** Deletes bounded computation rows for one work id. */
async function deleteComputations(
  ctx: MutationCtx,
  chatId: Doc<"chats">["_id"],
  workId: string
) {
  const rows = await ctx.db
    .query("mathComputations")
    .withIndex("by_chatId_and_workId_and_order", (q) =>
      q.eq("chatId", chatId).eq("workId", workId)
    )
    .take(MAX_MATH_WORK_CHILD_ROWS + 1);

  await deleteBoundedRows(ctx, rows, "MATH_WORK_COMPUTATION_LIMIT_EXCEEDED");
}

/** Deletes bounded derivation step rows for one work id. */
async function deleteSteps(
  ctx: MutationCtx,
  chatId: Doc<"chats">["_id"],
  workId: string
) {
  const rows = await ctx.db
    .query("mathWorkSteps")
    .withIndex("by_chatId_and_workId_and_order", (q) =>
      q.eq("chatId", chatId).eq("workId", workId)
    )
    .take(MAX_MATH_WORK_CHILD_ROWS + 1);

  await deleteBoundedRows(ctx, rows, "MATH_WORK_STEP_LIMIT_EXCEEDED");
}

/** Deletes bounded render artifact rows for one work id. */
async function deleteArtifacts(
  ctx: MutationCtx,
  chatId: Doc<"chats">["_id"],
  workId: string
) {
  const rows = await ctx.db
    .query("mathWorkArtifacts")
    .withIndex("by_chatId_and_workId_and_kind", (q) =>
      q.eq("chatId", chatId).eq("workId", workId)
    )
    .take(MAX_MATH_WORK_CHILD_ROWS + 1);

  await deleteBoundedRows(ctx, rows, "MATH_WORK_ARTIFACT_LIMIT_EXCEEDED");
}

/** Deletes one bounded set of child documents or rejects oversized state. */
async function deleteBoundedRows(
  ctx: MutationCtx,
  rows: readonly { readonly _id: MathChildId }[],
  code: string
) {
  if (rows.length > MAX_MATH_WORK_CHILD_ROWS) {
    throw new ConvexError({
      code,
      message: "Existing MathWork rows exceeded the supported delete batch.",
    });
  }

  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}

/** Inserts normalized computation rows for one MathWork result. */
async function insertComputations(
  ctx: MutationCtx,
  chatId: Doc<"chats">["_id"],
  userId: Doc<"users">["_id"],
  result: MathWorkResultInput
) {
  for (const [order, computation] of result.work.computations.entries()) {
    await ctx.db.insert("mathComputations", {
      chatId,
      computation,
      operation: computation.operation,
      order,
      status: computation.status,
      userId,
      workId: result.work.workId,
    });
  }
}

/** Inserts normalized derivation step rows for one MathWork result. */
async function insertSteps(
  ctx: MutationCtx,
  chatId: Doc<"chats">["_id"],
  userId: Doc<"users">["_id"],
  result: MathWorkResultInput
) {
  for (const step of result.steps) {
    await ctx.db.insert("mathWorkSteps", {
      ...step,
      chatId,
      userId,
    });
  }
}

/** Inserts normalized render artifact rows for one MathWork result. */
async function insertArtifacts(
  ctx: MutationCtx,
  chatId: Doc<"chats">["_id"],
  userId: Doc<"users">["_id"],
  result: MathWorkResultInput
) {
  for (const artifact of result.artifacts) {
    await ctx.db.insert("mathWorkArtifacts", {
      ...artifact,
      chatId,
      userId,
    });
  }
}
