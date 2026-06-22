import { api, internal } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 5, 22, 12, 0, 0);

describe("chats/traces", () => {
  it("persists bounded owner-scoped capability traces", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "trace-owner",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Trace chat",
        type: "study",
        updatedAt: NOW,
        userId: user.userId,
        visibility: "private",
      });

      return { ...user, chatId };
    });
    const owner = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    const traceId = await owner.mutation(api.chats.traces.mutations.save, {
      chatId: identity.chatId,
      trace: {
        capability: "math",
        durationMs: 8,
        endedAt: NOW + 8,
        evidence: {
          capability: "math",
          status: "available",
          summary: "checked derivative evidence",
        },
        responseMessageIdentifier: "response-1",
        startedAt: NOW,
        toolCallId: "tool-1",
      },
    });
    const traces = await owner.query(api.chats.traces.queries.list, {
      chatId: identity.chatId,
      responseMessageIdentifier: "response-1",
    });

    expect(traces).toEqual([
      expect.objectContaining({
        _id: traceId,
        capability: "math",
        responseMessageIdentifier: "response-1",
        status: "available",
        userId: identity.userId,
      }),
    ]);
    expect(traces[0]?.evidence.summary).toBe("checked derivative evidence");
  });

  it("deletes only expired derived trace summaries in bounded batches", async () => {
    const t = createConvexTestWithBetterAuth();
    const { expiredId, retainedId } = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "trace-cleanup",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Trace cleanup",
        type: "study",
        updatedAt: NOW,
        userId: user.userId,
        visibility: "private",
      });
      const expiredId = await ctx.db.insert("ninaCapabilityTraces", {
        capability: "nakafa",
        chatId,
        durationMs: 4,
        endedAt: NOW,
        evidence: {
          capability: "nakafa",
          status: "available",
          summary: "retrieved lesson summary",
        },
        expiresAt: NOW - 1,
        responseMessageIdentifier: "response-1",
        startedAt: NOW - 4,
        status: "available",
        userId: user.userId,
      });
      const retainedId = await ctx.db.insert("ninaCapabilityTraces", {
        capability: "nakafa",
        chatId,
        durationMs: 4,
        endedAt: NOW,
        evidence: {
          capability: "nakafa",
          status: "available",
          summary: "retrieved lesson summary",
        },
        expiresAt: NOW + 1,
        responseMessageIdentifier: "response-2",
        startedAt: NOW - 4,
        status: "available",
        userId: user.userId,
      });

      return { expiredId, retainedId };
    });

    const result = await t.mutation(
      internal.chats.traces.mutations.deleteExpiredBatch,
      { now: NOW }
    );
    const rows = await t.query(
      async (ctx) => await ctx.db.query("ninaCapabilityTraces").collect()
    );

    expect(result).toEqual({ deleted: 1, hasMore: false });
    expect(rows.map((row) => row._id)).toEqual([retainedId]);
    expect(rows.map((row) => row._id)).not.toContain(expiredId);
  });
});
