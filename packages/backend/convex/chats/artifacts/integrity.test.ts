import { buildLearningArtifactManifest } from "@repo/ai/schema/artifact";
import { internal } from "@repo/backend/convex/_generated/api";
import type { LearningArtifactWrite } from "@repo/backend/convex/chats/artifacts/spec";
import type { partValidator } from "@repo/backend/convex/chats/schema";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { decodeLearningArtifact } from "@repo/math/schema/artifact/schema";
import type { Infer } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const now = Date.UTC(2026, 5, 23, 12, 0, 0);

describe("chats/artifacts/integrity", () => {
  it("reports manifest field drift without aborting integrity checks", async () => {
    const t = convexTest(schema, convexModules);
    const artifact = createCoordinateArtifact("artifact-drift");
    const manifest = await createManifest(artifact);
    const seeded = await seedArtifactMessage(t, {
      artifactId: artifact.id,
      manifest,
    });

    await t.mutation(internal.chats.artifacts.internal.insertForMessage, {
      artifacts: [{ artifact, partOrder: 0 }],
      chatId: seeded.chatId,
      messageId: seeded.messageId,
      parts: [createArtifactPart(manifest)],
    });
    await t.mutation(async (ctx) => {
      const part = await ctx.db
        .query("parts")
        .withIndex("by_messageId_and_order", (q) =>
          q.eq("messageId", seeded.messageId).eq("order", 0)
        )
        .unique();
      if (part?.type === "data-artifact" && part.dataArtifactData) {
        await ctx.db.patch(part._id, {
          dataArtifactData: { ...part.dataArtifactData, title: "Stale title" },
        });
      }
    });

    const integrity = await t.query(
      internal.chats.artifacts.internal.checkPayloadIntegrity,
      { paginationOpts: { cursor: null, numItems: 10 } }
    );

    expect(integrity.issues).toEqual([
      expect.objectContaining({
        artifactId: artifact.id,
        reason: "Artifact manifest fields do not match the payload row.",
      }),
    ]);
  });
});

/** Builds a manifest through the same Effect contract used by write paths. */
async function createManifest(input: unknown) {
  const artifact = await Effect.runPromise(decodeLearningArtifact(input));
  return Effect.runPromise(buildLearningArtifactManifest(artifact));
}

/** Seeds the minimal chat/message/part rows needed by integrity checks. */
async function seedArtifactMessage(
  t: TestConvex<typeof schema>,
  {
    artifactId,
    manifest,
  }: {
    artifactId: string;
    manifest: Awaited<ReturnType<typeof createManifest>>;
  }
) {
  return await t.mutation(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      authId: `auth-${artifactId}`,
      credits: 10,
      creditsResetAt: now,
      email: `${artifactId}@example.com`,
      name: "Artifact Owner",
      plan: "free",
    });
    const chatId = await ctx.db.insert("chats", {
      title: "Artifact chat",
      type: "study",
      updatedAt: now,
      userId,
      visibility: "public",
    });
    const messageId = await ctx.db.insert("messages", {
      chatId,
      identifier: `assistant-${artifactId}`,
      role: "assistant",
    });
    await ctx.db.insert("parts", {
      messageId,
      ...createArtifactPart(manifest),
    });

    return { chatId, messageId };
  });
}

/** Creates the manifest-only transcript part for one artifact. */
function createArtifactPart(
  manifest: Awaited<ReturnType<typeof createManifest>>
): Omit<Infer<typeof partValidator>, "messageId"> {
  return {
    dataArtifactData: manifest,
    dataArtifactId: manifest.artifactId,
    order: 0,
    type: "data-artifact",
  };
}

/** Builds one validated coordinate artifact payload fixture. */
function createCoordinateArtifact(
  id: string
): LearningArtifactWrite["artifact"] {
  return {
    description: "A bounded coordinate point artifact.",
    id,
    kind: "coordinate-system-3d",
    payload: {
      axes: {
        x: [scalar("-1"), scalar("1")],
        y: [scalar("-1"), scalar("1")],
        z: [scalar("-1"), scalar("1")],
      },
      primitives: [{ id: "origin", kind: "point", point: point("0", "0") }],
      sampling: { curveSamples: 16, surfaceCells: 8 },
    },
    proofAnchors: ["cas://artifact/origin"],
    title: "Coordinate artifact",
  };
}

/** Creates one exact point fixture on the z=0 plane. */
function point(x: string, y: string) {
  return { x: scalar(x), y: scalar(y), z: scalar("0") };
}

/** Creates one exact scalar fixture for artifact coordinates. */
function scalar(expression: string) {
  return { expression, latex: expression };
}
