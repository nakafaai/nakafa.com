import { buildLearningArtifactManifest } from "@repo/ai/schema/artifact";
import { api, internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { LearningArtifactWrite } from "@repo/backend/convex/chats/artifacts/spec";
import { mapDBPartToUIMessagePart } from "@repo/backend/convex/chats/messageParts/dbToUi";
import type { partValidator } from "@repo/backend/convex/chats/schema";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { decodeLearningArtifact } from "@repo/math/schema/artifact/schema";
import type { Infer } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const now = Date.UTC(2026, 5, 23, 12, 0, 0);

describe("chats/artifacts/internal", () => {
  it("persists payloads behind manifest-only message parts", async () => {
    const t = convexTest(schema, convexModules);
    const artifact = createCoordinateArtifact("artifact-internal-1");
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

    const saved = await t.query(async (ctx) => ({
      artifacts: await ctx.db.query("learningArtifacts").collect(),
      parts: await ctx.db.query("parts").collect(),
    }));
    const payloadIntegrity = await t.query(
      internal.chats.artifacts.internal.checkPayloadIntegrity,
      { paginationOpts: { cursor: null, numItems: 10 } }
    );
    const manifestIntegrity = await t.query(
      internal.chats.artifacts.internal.checkManifestIntegrity,
      { paginationOpts: { cursor: null, numItems: 10 } }
    );

    expect(saved.artifacts).toEqual([
      expect.objectContaining({
        artifactId: "artifact-internal-1",
        messageId: seeded.messageId,
        partOrder: 0,
        primitiveCount: 1,
      }),
    ]);
    expect("payload" in saved.parts[0]).toBe(false);
    expect(saved.parts[0]).toMatchObject({
      dataArtifactData: manifest,
      dataArtifactId: artifact.id,
      type: "data-artifact",
    });
    expect(mapDBPartToUIMessagePart({ part: saved.parts[0] })).toEqual({
      data: manifest,
      id: artifact.id,
      type: "data-artifact",
    });
    expect(payloadIntegrity).toMatchObject({ checked: 1, issues: [] });
    expect(manifestIntegrity).toMatchObject({ checked: 1, issues: [] });
  });

  it("loads visible payloads through chat access and deletes by message", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(
      async (ctx) =>
        await seedAuthenticatedUser(ctx, {
          now,
          suffix: "artifact-owner",
        })
    );
    const artifact = createCoordinateArtifact("artifact-visible-1");
    const manifest = await createManifest(artifact);
    const seeded = await seedArtifactMessage(t, {
      artifactId: artifact.id,
      manifest,
      userId: identity.userId,
      visibility: "private",
    });

    await t.mutation(internal.chats.artifacts.internal.insertForMessage, {
      artifacts: [{ artifact, partOrder: 0 }],
      chatId: seeded.chatId,
      messageId: seeded.messageId,
      parts: [createArtifactPart(manifest)],
    });

    await expect(
      t.query(api.chats.artifacts.queries.loadVisible, {
        artifactId: artifact.id,
      })
    ).rejects.toThrow("private chat");

    const owner = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const loaded = await owner.query(api.chats.artifacts.queries.loadVisible, {
      artifactId: artifact.id,
    });

    expect(loaded).toMatchObject({
      artifactId: artifact.id,
      kind: "coordinate-system-3d",
      payload: {
        primitives: [expect.objectContaining({ kind: "point" })],
      },
      title: "Coordinate artifact",
    });

    const deleted = await t.mutation(
      internal.chats.artifacts.internal.deleteForMessage,
      { messageId: seeded.messageId }
    );
    const artifactsAfterDelete = await t.query(
      async (ctx) => await ctx.db.query("learningArtifacts").collect()
    );

    expect(deleted.hasMore).toBe(false);
    expect(artifactsAfterDelete).toEqual([]);
  });
});

async function createManifest(input: unknown) {
  const artifact = await Effect.runPromise(decodeLearningArtifact(input));
  return Effect.runPromise(buildLearningArtifactManifest(artifact));
}

async function seedArtifactMessage(
  t: TestConvex<typeof schema>,
  {
    artifactId,
    manifest,
    userId,
    visibility = "public",
  }: {
    artifactId: string;
    manifest: Awaited<ReturnType<typeof createManifest>>;
    userId?: Id<"users">;
    visibility?: "private" | "public";
  }
) {
  return await t.mutation(async (ctx) => {
    const ownerId =
      userId ??
      (await ctx.db.insert("users", {
        authId: `auth-${artifactId}`,
        credits: 10,
        creditsResetAt: now,
        email: `${artifactId}@example.com`,
        name: "Artifact Owner",
        plan: "free",
      }));
    const chatId = await ctx.db.insert("chats", {
      title: "Artifact chat",
      type: "study",
      updatedAt: now,
      userId: ownerId,
      visibility,
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
      primitives: [
        {
          id: "origin",
          kind: "point",
          point: point("0", "0", "0"),
        },
      ],
      sampling: {
        curveSamples: 16,
        surfaceCells: 8,
      },
    },
    proofAnchors: ["cas://artifact/origin"],
    title: "Coordinate artifact",
  };
}

function point(x: string, y: string, z: string) {
  return { x: scalar(x), y: scalar(y), z: scalar(z) };
}

function scalar(expression: string) {
  return { expression, latex: expression };
}
