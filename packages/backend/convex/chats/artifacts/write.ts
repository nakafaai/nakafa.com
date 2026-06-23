import {
  buildLearningArtifactManifest,
  isSameLearningArtifactManifest,
  type LearningArtifactManifest,
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
type DecodedLearningArtifactWrite = Schema.Schema.Type<
  typeof DecodedLearningArtifactWriteSchema
>;

/**
 * Decodes artifact write inputs through the Effect-owned math contract.
 * Convex route handlers run this Effect at their framework boundary.
 */
export const decodeArtifactWrites = Effect.fn(
  "backend.chats.artifacts.decodeWrites"
)(function* (artifacts: readonly LearningArtifactWrite[]) {
  assertArtifactWriteBudget(artifacts);
  const decoded: DecodedLearningArtifactWrite[] = [];

  for (const artifactInput of artifacts) {
    assertPartOrder(artifactInput.partOrder);
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
  const artifactByOrder = readArtifactWritesByOrder(artifacts);
  const manifestByOrder = readArtifactManifestsByOrder(parts);
  assertArtifactManifestCoverage(artifactByOrder, manifestByOrder);

  const artifactIds: Id<"learningArtifacts">[] = [];
  for (const artifactInput of artifacts) {
    const artifact = artifactInput.artifact;
    const storedManifest = manifestByOrder.get(artifactInput.partOrder);

    if (
      !(
        storedManifest &&
        isSameLearningArtifactManifest(storedManifest, artifactInput.manifest)
      )
    ) {
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
  if (artifacts.length > MAX_CHAT_MESSAGE_PARTS) {
    throw new ConvexError({
      code: "LEARNING_ARTIFACT_LIMIT_EXCEEDED",
      message: "Artifact batch exceeds the supported message part budget.",
    });
  }
}

/**
 * Indexes artifact payload writes by the part order they must accompany.
 */
function readArtifactWritesByOrder(
  artifacts: readonly DecodedLearningArtifactWrite[]
) {
  const artifactByOrder = new Map<number, DecodedLearningArtifactWrite>();
  for (const artifact of artifacts) {
    assertPartOrder(artifact.partOrder);
    if (artifactByOrder.has(artifact.partOrder)) {
      throw new ConvexError({
        code: "LEARNING_ARTIFACT_DUPLICATE_PART_ORDER",
        message: "Artifact write contains duplicate part orders.",
      });
    }

    artifactByOrder.set(artifact.partOrder, artifact);
  }

  return artifactByOrder;
}

/**
 * Reads artifact manifests from already-flattened message parts by part order.
 */
function readArtifactManifestsByOrder(parts: readonly PersistedPartInput[]) {
  const manifestByOrder = new Map<number, LearningArtifactManifest>();
  for (const part of parts) {
    if (part.type !== "data-artifact") {
      continue;
    }

    assertPartOrder(part.order);
    if (!part.dataArtifactData) {
      throw new ConvexError({
        code: "LEARNING_ARTIFACT_MANIFEST_MISSING",
        message: "Data artifact part is missing its manifest.",
      });
    }

    if (manifestByOrder.has(part.order)) {
      throw new ConvexError({
        code: "LEARNING_ARTIFACT_DUPLICATE_PART_ORDER",
        message: "Artifact manifests contain duplicate part orders.",
      });
    }

    manifestByOrder.set(part.order, part.dataArtifactData);
  }

  return manifestByOrder;
}

/**
 * Ensures every artifact payload has one matching manifest and no orphan part.
 */
function assertArtifactManifestCoverage(
  artifactByOrder: ReadonlyMap<number, DecodedLearningArtifactWrite>,
  manifestByOrder: ReadonlyMap<number, LearningArtifactManifest>
) {
  if (artifactByOrder.size !== manifestByOrder.size) {
    throw new ConvexError({
      code: "LEARNING_ARTIFACT_MANIFEST_MISMATCH",
      message: "Artifact payloads and manifests must match one-for-one.",
    });
  }

  for (const order of manifestByOrder.keys()) {
    if (!artifactByOrder.has(order)) {
      throw new ConvexError({
        code: "LEARNING_ARTIFACT_PAYLOAD_MISSING",
        message: "Data artifact manifest has no durable payload.",
      });
    }
  }
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
 * Validates persisted part ordering before using it as an artifact join key.
 */
function assertPartOrder(order: number) {
  if (!Number.isSafeInteger(order) || order < 0) {
    throw new ConvexError({
      code: "LEARNING_ARTIFACT_PART_ORDER_INVALID",
      message: "Artifact part order must be a non-negative safe integer.",
    });
  }
}
