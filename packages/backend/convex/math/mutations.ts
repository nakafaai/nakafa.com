import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { verifyChatOwnership } from "@repo/backend/convex/chats/helpers";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  deleteExistingMathWork,
  deletePedagogyProjections,
} from "@repo/backend/convex/math/cleanup";
import {
  mathPedagogyProjectionValidator,
  mathWorkResultValidator,
} from "@repo/backend/convex/math/spec";
import { ConvexError, type Infer, v } from "convex/values";

const MAX_MATH_WORK_CHILD_ROWS = 100;
const MAX_PEDAGOGY_SENTENCES = 20;
type MathWorkResultInput = Infer<typeof mathWorkResultValidator>;
type MathPedagogyProjectionInput = Infer<
  typeof mathPedagogyProjectionValidator
>;

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

/** Saves one non-canonical live PedagogyProjection for an existing MathWork. */
export const savePedagogyProjection = mutation({
  args: {
    chatId: vv.id("chats"),
    projection: mathPedagogyProjectionValidator,
    responseMessageIdentifier: v.optional(v.string()),
    toolCallId: v.optional(v.string()),
  },
  returns: v.object({
    evidenceHash: v.string(),
    sentenceCount: v.number(),
    workId: v.string(),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const { chatId, projection } = args;

    await verifyChatOwnership(ctx, chatId, appUser._id);
    assertBoundedPedagogyProjection(projection);

    const work = await ctx.db
      .query("mathWorks")
      .withIndex("by_chatId_and_workId", (q) =>
        q.eq("chatId", chatId).eq("workId", projection.workId)
      )
      .unique();

    if (!work || work.userId !== appUser._id) {
      throw new ConvexError({
        code: "MATH_WORK_NOT_FOUND",
        message: "MathWork was not found for this pedagogy projection.",
      });
    }

    await deletePedagogyProjections(ctx, chatId, projection.workId);
    await ctx.db.insert("mathPedagogyProjections", {
      chatId,
      evidenceHash: projection.evidenceHash,
      modelId: projection.model.modelId,
      projection,
      promptVersion: projection.model.promptVersion,
      ...(args.responseMessageIdentifier
        ? { responseMessageIdentifier: args.responseMessageIdentifier }
        : {}),
      schemaVersion: projection.model.schemaVersion,
      ...(args.toolCallId ? { toolCallId: args.toolCallId } : {}),
      userId: appUser._id,
      workId: projection.workId,
    });

    return {
      evidenceHash: projection.evidenceHash,
      sentenceCount: projection.sentences.length,
      workId: projection.workId,
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

/** Rejects oversized live pedagogy projections before insertion. */
function assertBoundedPedagogyProjection(
  projection: MathPedagogyProjectionInput
) {
  if (projection.sentences.length > MAX_PEDAGOGY_SENTENCES) {
    throw new ConvexError({
      code: "MATH_PEDAGOGY_TOO_LARGE",
      message: "PedagogyProjection exceeded the supported sentence limit.",
    });
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
      workId: result.work.workId,
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
      workId: result.work.workId,
    });
  }
}
