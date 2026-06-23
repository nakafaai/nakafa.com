import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { deleteArtifactsForChatBatch } from "@repo/backend/convex/chats/artifacts/delete";
import {
  LEARNING_ARTIFACT_SCHEMA_VERSION,
  type learningArtifactRowValidator,
} from "@repo/backend/convex/chats/artifacts/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { COORDINATE_SYSTEM_ARTIFACT_KIND } from "@repo/math/schema/artifact/schema";
import type { Infer } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const now = Date.UTC(2026, 5, 23, 12, 0, 0);

describe("chats/artifacts/delete", () => {
  it("deletes durable artifact rows by owning chat before chat removal", async () => {
    const t = convexTest(schema, convexModules);
    const ids = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-delete-artifacts",
        credits: 10,
        creditsResetAt: now,
        email: "delete-artifacts@example.com",
        name: "Artifact Owner",
        plan: "free",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Artifact chat",
        type: "study",
        updatedAt: now,
        userId,
        visibility: "private",
      });
      const otherChatId = await ctx.db.insert("chats", {
        title: "Other chat",
        type: "study",
        updatedAt: now,
        userId,
        visibility: "private",
      });
      const messageId = await ctx.db.insert("messages", {
        chatId,
        identifier: "assistant-delete",
        role: "assistant",
      });
      const otherMessageId = await ctx.db.insert("messages", {
        chatId: otherChatId,
        identifier: "assistant-keep",
        role: "assistant",
      });

      await ctx.db.insert(
        "learningArtifacts",
        artifactRow(
          chatId,
          messageId,
          "artifact-delete",
          "Deleted coordinate artifact"
        )
      );
      await ctx.db.insert(
        "learningArtifacts",
        artifactRow(
          otherChatId,
          otherMessageId,
          "artifact-keep",
          "Kept coordinate artifact"
        )
      );

      return { chatId };
    });

    const deleted = await t.mutation((ctx) =>
      deleteArtifactsForChatBatch(ctx, ids.chatId)
    );
    const remaining = await t.query(
      async (ctx) => await ctx.db.query("learningArtifacts").collect()
    );

    expect(deleted.hasMore).toBe(false);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.artifactId).toBe("artifact-keep");
  });
});

/** Creates one durable artifact row fixture for chat deletion checks. */
function artifactRow(
  chatId: Id<"chats">,
  messageId: Id<"messages">,
  artifactId: string,
  title: string
): Infer<typeof learningArtifactRowValidator> {
  return {
    artifactId,
    chatId,
    kind: COORDINATE_SYSTEM_ARTIFACT_KIND,
    messageId,
    partOrder: 0,
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
          point: { x: scalar("0"), y: scalar("0"), z: scalar("0") },
        },
      ],
      sampling: { curveSamples: 16, surfaceCells: 8 },
    },
    payloadBytes: 256,
    primitiveCount: 1,
    proofAnchors: ["cas://artifact/origin"],
    schemaVersion: LEARNING_ARTIFACT_SCHEMA_VERSION,
    title,
  };
}

/** Creates one exact scalar fixture for durable artifact rows. */
function scalar(expression: string) {
  return { expression, latex: expression };
}
