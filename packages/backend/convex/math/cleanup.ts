import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

const MAX_MATH_WORK_CHILD_ROWS = 100;
const MAX_MATH_WORK_RESPONSE_ROWS = 25;
type MathChildId =
  | Doc<"mathComputations">["_id"]
  | Doc<"mathPedagogyProjections">["_id"]
  | Doc<"mathWorkArtifacts">["_id"]
  | Doc<"mathWorkSteps">["_id"];

/** Deletes the existing normalized rows for one work id using indexed batches. */
export async function deleteExistingMathWork(
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

  await deleteMathWorkRows(ctx, chatId, existing);
}

/** Deletes bounded MathWork rows associated with one assistant response id. */
export async function deleteMathWorkForResponseIdentifier(
  ctx: MutationCtx,
  chatId: Doc<"chats">["_id"],
  responseMessageIdentifier: string
) {
  const works = await ctx.db
    .query("mathWorks")
    .withIndex("by_chatId_and_responseMessageIdentifier", (q) =>
      q
        .eq("chatId", chatId)
        .eq("responseMessageIdentifier", responseMessageIdentifier)
    )
    .take(MAX_MATH_WORK_RESPONSE_ROWS + 1);

  for (const work of works.slice(0, MAX_MATH_WORK_RESPONSE_ROWS)) {
    await deleteMathWorkRows(ctx, chatId, work);
  }

  return {
    hasMore: works.length > MAX_MATH_WORK_RESPONSE_ROWS,
  };
}

/** Deletes one MathWork root and its normalized child rows. */
async function deleteMathWorkRows(
  ctx: MutationCtx,
  chatId: Doc<"chats">["_id"],
  work: Doc<"mathWorks">
) {
  await deleteComputations(ctx, chatId, work.workId);
  await deleteSteps(ctx, chatId, work.workId);
  await deleteArtifacts(ctx, chatId, work.workId);
  await deletePedagogyProjections(ctx, chatId, work.workId);
  await ctx.db.delete(work._id);
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

/** Deletes bounded live pedagogy projection rows for one work id. */
export async function deletePedagogyProjections(
  ctx: MutationCtx,
  chatId: Doc<"chats">["_id"],
  workId: string
) {
  const rows = await ctx.db
    .query("mathPedagogyProjections")
    .withIndex("by_chatId_and_workId", (q) =>
      q.eq("chatId", chatId).eq("workId", workId)
    )
    .take(MAX_MATH_WORK_CHILD_ROWS + 1);

  await deleteBoundedRows(ctx, rows, "MATH_PEDAGOGY_LIMIT_EXCEEDED");
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
