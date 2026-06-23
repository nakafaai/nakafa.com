import {
  buildLearningArtifactManifest,
  LearningArtifactManifestSchema,
} from "@repo/ai/schema/artifact";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { MAX_CHAT_MESSAGE_PARTS } from "@repo/backend/convex/chats/constants";
import type { partValidator } from "@repo/backend/convex/chats/schema";
import {
  decodeLearningArtifact,
  LearningArtifactSchema,
} from "@repo/math/schema/artifact/schema";
import { ConvexError, type Infer } from "convex/values";
import { Effect, Schema } from "effect";
import {
  assertArtifactManifestCoverage,
  isMatchingArtifactManifest,
  readArtifactManifestsByOrder,
  readArtifactWritesByOrder,
  readPartOrderError,
} from "./manifest";
import { readStoredPayload } from "./material";
import {
  LEARNING_ARTIFACT_SCHEMA_VERSION,
  type LearningArtifactWrite,
} from "./spec";

type PersistedPartInput = Omit<Infer<typeof partValidator>, "messageId">;
const DecodedLearningArtifactWriteSchema = Schema.Struct({
  artifact: LearningArtifactSchema,
  manifest: LearningArtifactManifestSchema,
  partOrder: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
});
export type DecodedLearningArtifactWrite = Schema.Schema.Type<
  typeof DecodedLearningArtifactWriteSchema
>;

/**
 * Decodes artifact write inputs through the Effect-owned math contract.
 * Convex route handlers run this Effect at their framework boundary.
 */
export const decodeArtifactWrites = Effect.fn(
  "backend.chats.artifacts.decodeWrites"
)(function* (artifacts: readonly LearningArtifactWrite[]) {
  const budgetError = readArtifactWriteBudgetError(artifacts);
  if (budgetError) {
    return yield* Effect.fail(budgetError);
  }

  const decoded: DecodedLearningArtifactWrite[] = [];

  for (const artifactInput of artifacts) {
    const orderError = readPartOrderError(artifactInput.partOrder);
    if (orderError) {
      return yield* Effect.fail(orderError);
    }

    const artifact = yield* decodeLearningArtifact(artifactInput.artifact).pipe(
      Effect.mapError(
        (error) =>
          new ConvexError({
            code: "LEARNING_ARTIFACT_INVALID",
            message: error.message,
          })
      )
    );
    const manifest = yield* buildLearningArtifactManifest(artifact).pipe(
      Effect.mapError(
        (error) =>
          new ConvexError({
            code: "LEARNING_ARTIFACT_MANIFEST_INVALID",
            message: error.message,
          })
      )
    );
    decoded.push(
      DecodedLearningArtifactWriteSchema.make({
        artifact,
        manifest,
        partOrder: artifactInput.partOrder,
      })
    );
  }

  return decoded;
});

/**
 * Persists decoded learning artifact payloads for one message transaction.
 * Every artifact must have exactly one matching data-artifact part manifest.
 */
export async function insertArtifactsForMessage(
  ctx: MutationCtx,
  {
    artifacts,
    chatId,
    messageId,
    parts,
  }: {
    readonly artifacts: readonly DecodedLearningArtifactWrite[];
    readonly chatId: Id<"chats">;
    readonly messageId: Id<"messages">;
    readonly parts: readonly PersistedPartInput[];
  }
) {
  assertArtifactWriteBudget(artifacts);
  await assertArtifactMessageBelongsToChat(ctx, messageId, chatId);

  const artifactByOrder = readArtifactWritesByOrder(artifacts);
  const manifestByOrder = readArtifactManifestsByOrder(parts);
  assertArtifactManifestCoverage(artifactByOrder, manifestByOrder);

  const artifactIds: Id<"learningArtifacts">[] = [];
  for (const artifactInput of artifacts) {
    const artifact = artifactInput.artifact;
    const storedManifest = manifestByOrder.get(artifactInput.partOrder);

    if (!isMatchingArtifactManifest(storedManifest, artifactInput.manifest)) {
      throw new ConvexError({
        code: "LEARNING_ARTIFACT_MANIFEST_MISMATCH",
        message:
          "Artifact manifest must match the deterministic artifact payload.",
      });
    }

    await assertArtifactIdIsAvailable(ctx, artifact.id);

    artifactIds.push(
      await ctx.db.insert("learningArtifacts", {
        artifactId: artifact.id,
        chatId,
        description: artifact.description,
        kind: artifact.kind,
        messageId,
        partOrder: artifactInput.partOrder,
        payload: readStoredPayload(artifact),
        payloadBytes: artifactInput.manifest.payloadBytes,
        primitiveCount: artifact.payload.primitives.length,
        proofAnchors: artifact.proofAnchors,
        schemaVersion: LEARNING_ARTIFACT_SCHEMA_VERSION,
        title: artifact.title,
      })
    );
  }

  return artifactIds;
}

/**
 * Rejects artifact write batches that cannot fit inside one persisted message.
 */
function assertArtifactWriteBudget(
  artifacts:
    | readonly LearningArtifactWrite[]
    | readonly DecodedLearningArtifactWrite[]
) {
  const error = readArtifactWriteBudgetError(artifacts);
  if (error) {
    throw error;
  }
}

/**
 * Builds the budget failure shared by Effect validation and Convex adapters.
 */
function readArtifactWriteBudgetError(
  artifacts:
    | readonly LearningArtifactWrite[]
    | readonly DecodedLearningArtifactWrite[]
) {
  return artifacts.length > MAX_CHAT_MESSAGE_PARTS
    ? new ConvexError({
        code: "LEARNING_ARTIFACT_LIMIT_EXCEEDED",
        message: "Artifact batch exceeds the supported message part budget.",
      })
    : undefined;
}

/**
 * Refuses duplicate artifact ids before the payload becomes durable.
 */
async function assertArtifactIdIsAvailable(
  ctx: MutationCtx,
  artifactId: string
) {
  const duplicate = await ctx.db
    .query("learningArtifacts")
    .withIndex("by_artifactId", (q) => q.eq("artifactId", artifactId))
    .take(1);

  if (duplicate.length > 0) {
    throw new ConvexError({
      code: "LEARNING_ARTIFACT_DUPLICATE",
      message: "Learning artifact id already exists.",
    });
  }
}

/**
 * Requires artifact payload rows to be stored under the message's owning chat.
 */
async function assertArtifactMessageBelongsToChat(
  ctx: MutationCtx,
  messageId: Id<"messages">,
  chatId: Id<"chats">
) {
  const message = await ctx.db.get(messageId);
  if (!message || message.chatId !== chatId) {
    throw new ConvexError({
      code: "LEARNING_ARTIFACT_MESSAGE_CHAT_MISMATCH",
      message: "Artifact message must belong to the artifact chat.",
    });
  }
}
