import { internalQuery } from "@repo/backend/convex/_generated/server";
import { deleteArtifactsForMessageBatch } from "@repo/backend/convex/chats/artifacts/delete";
import {
  checkManifestIntegrityPage,
  checkPayloadIntegrityPage,
} from "@repo/backend/convex/chats/artifacts/integrity";
import {
  artifactIntegrityPageValidator,
  learningArtifactWriteValidator,
} from "@repo/backend/convex/chats/artifacts/spec";
import {
  decodeArtifactWrites,
  insertArtifactsForMessage,
} from "@repo/backend/convex/chats/artifacts/write";
import tables from "@repo/backend/convex/chats/schema";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const persistedPartInputValidator = v.object({
  ...tables.parts.validator.fields,
  messageId: v.optional(vv.id("messages")),
});

/** Internal transactional artifact write seam for chat message persistence. */
export const insertForMessage = internalMutation({
  args: {
    artifacts: v.array(learningArtifactWriteValidator),
    chatId: vv.id("chats"),
    messageId: vv.id("messages"),
    parts: v.array(persistedPartInputValidator),
  },
  returns: v.array(vv.id("learningArtifacts")),
  handler: async (ctx, args) => {
    const artifacts = await Effect.runPromise(
      decodeArtifactWrites(args.artifacts)
    );
    return insertArtifactsForMessage(ctx, {
      artifacts,
      chatId: args.chatId,
      messageId: args.messageId,
      parts: args.parts,
    });
  },
});

/** Deletes one bounded artifact batch for transcript rewrite cleanup. */
export const deleteForMessage = internalMutation({
  args: {
    messageId: vv.id("messages"),
  },
  returns: v.object({
    hasMore: v.boolean(),
  }),
  handler: (ctx, args) => deleteArtifactsForMessageBatch(ctx, args.messageId),
});

/** Paginates durable payload rows and verifies their transcript manifests. */
export const checkPayloadIntegrity = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: artifactIntegrityPageValidator,
  handler: (ctx, args) => checkPayloadIntegrityPage(ctx, args.paginationOpts),
});

/** Paginates transcript manifest rows and verifies their durable payloads. */
export const checkManifestIntegrity = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: artifactIntegrityPageValidator,
  handler: (ctx, args) => checkManifestIntegrityPage(ctx, args.paginationOpts),
});
