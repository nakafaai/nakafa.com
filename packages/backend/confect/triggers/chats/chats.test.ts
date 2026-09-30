import { Ref } from "@confect/core";
import { createThread, saveMessage } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { openNinaLearningSession } from "@repo/backend/confect/nina/memory/pack";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));
const NOW = Date.UTC(2026, 8, 27, 12);
const start = Ref.getFunctionReference(refs.public.nina.turns.start);
const save = Ref.getFunctionReference(refs.public.nina.uploads.save);
const remove = Ref.getFunctionReference(refs.public.chats.mutations.deleteChat);
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const cleanup = Ref.getFunctionReference(
  refs.internal.auth.cleanup.cleanupDeletedUser
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(resolveNinaContext).mockReturnValue(
    openNinaLearningSession({
      capturedAt: new Date(NOW).toISOString(),
      source: "current-page",
      learning: {
        locale: "en",
        slug: "home",
        url: "https://nakafa.com/en/home",
        verified: false,
      },
    }).pipe(
      Effect.orDie,
      Effect.map((session) => ({
        page: {
          locale: "en" as const,
          slug: "home",
          url: "https://nakafa.com/en/home",
          verified: false,
          needsFetch: false,
          nina: session.context,
        },
        user: {},
      }))
    )
  );
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

async function fixture() {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, credits: 10 })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const uploadId = Ref.decodeReturnsSync(
    refs.public.nina.uploads.save,
    await owner.action(save, {
      bytes: new TextEncoder().encode("private lesson").buffer,
      filename: "lesson.txt",
      mediaType: "text/plain",
    })
  );
  const grant = await t.query((ctx) => ctx.db.get("ninaUploads", uploadId));
  if (grant?.state.status !== "ready") {
    throw new Error("Expected ready upload");
  }
  const receipt = Ref.decodeReturnsSync(
    refs.public.nina.turns.start,
    await owner.mutation(start, {
      requestId: "first",
      modelId: "nakafa-lite",
      input: {
        kind: "message",
        prompt: { text: "Explain the lesson", uploadIds: [uploadId] },
        page: { locale: "en", slug: "home" },
      },
    })
  );
  return { t, owner, identity, receipt, fileId: grant.state.fileId };
}

describe("native Nina deletion lifecycle", () => {
  it("deletes a chat whose active turn was already removed", async () => {
    const { t, owner, receipt } = await fixture();
    await t.mutation((ctx) => ctx.db.delete("ninaTurns", receipt.turnId));
    await owner.mutation(remove, { chatId: receipt.chatId });
    expect(
      await t.query((ctx) => ctx.db.get("chats", receipt.chatId))
    ).toBeNull();
  });
  it("cancels queued generation and removes the Agent journal before late writes can recreate it", async () => {
    const { t, owner, identity, receipt, fileId } = await fixture();
    await t.mutation(async (ctx) => {
      for (let order = 1; order <= 25; order += 1) {
        await ctx.db.insert("ninaTurns", {
          userId: identity.userId,
          chatId: receipt.chatId,
          threadId: receipt.threadId,
          promptMessageId: receipt.promptMessageId,
          order,
          usage: [],
          phase: "unanswered",
          state: { status: "unanswered" },
        });
      }
      await ctx.db.insert("ninaSummaries", {
        chatId: receipt.chatId,
        text: "- The learner asked about limits.",
        throughOrder: 20,
        updatedAt: NOW,
        usage: { calls: 1, input: 900, output: 120 },
      });
    });
    await owner.mutation(remove, { chatId: receipt.chatId });
    expect(
      Ref.decodeReturnsSync(
        refs.internal.nina.lifecycle.claim,
        await t.mutation(claim, { turnId: receipt.turnId })
      )
    ).toBeNull();
    vi.runAllTimers();
    await vi.dynamicImportSettled();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const state = await t.query(async (ctx) => ({
      chat: await ctx.db.get("chats", receipt.chatId),
      turns: await ctx.db.query("ninaTurns").collect(),
      summaries: await ctx.db.query("ninaSummaries").collect(),
      messages: await ctx.runQuery(
        components.nina.messages.listMessagesByThreadId,
        {
          threadId: receipt.threadId,
          paginationOpts: { cursor: null, numItems: 10 },
          order: "asc",
        }
      ),
      threads: await ctx.runQuery(components.nina.threads.listThreadsByUserId, {
        userId: identity.userId,
        paginationOpts: { cursor: null, numItems: 10 },
      }),
      file: await ctx.runQuery(components.nina.files.get, { fileId }),
      ledger: await ctx.db.query("creditTransactions").collect(),
      user: await ctx.db.get("users", identity.userId),
    }));
    expect(state.chat).toBeNull();
    expect(state.turns).toEqual([]);
    expect(state.summaries).toEqual([]);
    expect(state.messages.page).toEqual([]);
    expect(state.threads.page).toEqual([]);
    expect(state.file).toMatchObject({ refcount: 0 });
    expect(state.ledger.filter((row) => row.type === "refund")).toHaveLength(1);
    expect(state.user?.credits).toBe(10);
    await expect(
      t.mutation((ctx) =>
        saveMessage(ctx, components.nina, {
          threadId: receipt.threadId,
          message: { role: "assistant", content: "late response" },
          promptMessageId: receipt.promptMessageId,
        })
      )
    ).rejects.toThrow();
  });

  it("account cleanup removes owned pending grants and Agent threads while preserving another owner's journal", async () => {
    const { t, owner, identity, receipt } = await fixture();
    const pending = Ref.decodeReturnsSync(
      refs.public.nina.uploads.save,
      await owner.action(save, {
        bytes: new TextEncoder().encode("not sent").buffer,
        filename: "draft.txt",
        mediaType: "text/plain",
      })
    );
    const retained = await t.mutation(async (ctx) => {
      const other = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "retained",
      });
      const threadId = await createThread(ctx, components.nina, {
        userId: other.userId,
      });
      await saveMessage(ctx, components.nina, {
        threadId,
        userId: other.userId,
        prompt: "Retained lesson",
      });
      await ctx.db.patch(
        "users",
        identity.userId,
        createDeletedUserTombstone(identity.userId, NOW)
      );
      return { userId: other.userId, threadId };
    });
    for (let batch = 0; batch < 20; batch += 1) {
      if (!(await t.mutation(cleanup, { userId: identity.userId }))) {
        break;
      }
    }
    vi.runAllTimers();
    await vi.dynamicImportSettled();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await t.query((ctx) => ctx.db.get("ninaUploads", pending))
    ).toBeNull();
    expect(
      await t.query((ctx) => ctx.db.get("chats", receipt.chatId))
    ).toBeNull();
    expect(await t.query((ctx) => ctx.db.query("ninaTurns").collect())).toEqual(
      []
    );
    const retainedMessages = await t.query((ctx) =>
      ctx.runQuery(components.nina.messages.listMessagesByThreadId, {
        threadId: retained.threadId,
        paginationOpts: { cursor: null, numItems: 10 },
        order: "asc",
      })
    );
    expect(retainedMessages.page).toHaveLength(1);
    expect(
      await t.query((ctx) =>
        ctx.runQuery(components.nina.threads.listThreadsByUserId, {
          userId: identity.userId,
          paginationOpts: { cursor: null, numItems: 10 },
        })
      )
    ).toMatchObject({ page: [] });
  });
});
