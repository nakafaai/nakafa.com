import { Ref } from "@confect/core";
import { abortStream, createThread, saveMessage } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import { CreditStateError } from "@repo/backend/confect/credits/spec";
import { resolveEffectiveCreditState } from "@repo/backend/confect/credits/state";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { readThread } from "@repo/backend/confect/nina/sealed/thread";
import { SealedReadError } from "@repo/backend/confect/nina/sealed.spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { contextFor } from "@repo/backend/test/nina/admission";
import { sealedSummary } from "@repo/backend/test/seal";
import { Array as Arr, Effect } from "effect";

vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));
vi.mock("@repo/backend/confect/credits/state", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/credits/state")>();
  return {
    ...actual,
    resolveEffectiveCreditState: vi.fn(actual.resolveEffectiveCreditState),
  };
});
vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return {
    ...actual,
    abortStream: vi.fn(actual.abortStream),
  };
});
vi.mock("@repo/backend/confect/nina/sealed/thread", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/nina/sealed/thread")>();
  return { ...actual, readThread: vi.fn(actual.readThread) };
});
const NOW = Date.UTC(2026, 8, 27, 12);
const start = Ref.getFunctionReference(refs.public.nina.turns.start);
const save = Ref.getFunctionReference(refs.public.nina.uploads.save);
const add = Ref.getFunctionReference(refs.public.nina.memory.add);
const capture = Ref.getFunctionReference(refs.internal.nina.memory.capture);
const remove = Ref.getFunctionReference(refs.public.chats.mutations.deleteChat);
const share = Ref.getFunctionReference(
  refs.public.chats.mutations.updateChatVisibility
);
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const halted = Ref.getFunctionReference(refs.internal.nina.phase.halted);
const cleanup = Ref.getFunctionReference(
  refs.internal.auth.cleanup.cleanupDeletedUser
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(resolveNinaContext).mockReturnValue(contextFor("home"));
});
afterEach(() => {
  vi.mocked(readThread).mockReset();
  vi.mocked(abortStream).mockReset();
  vi.mocked(resolveEffectiveCreditState).mockReset();
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
      input: {
        kind: "message",
        prompt: { text: "Explain the lesson", uploadIds: [uploadId] },
        page: { locale: "en", slug: "home" },
      },
    })
  );
  /** What a delete leaves of the chat, its first turn, the learner's credits and the ledger. */
  const read = () =>
    t.query(async (ctx) => ({
      chat: await ctx.db.get("chats", receipt.chatId),
      turn: await ctx.db.get("ninaTurns", receipt.turnId),
      user: await ctx.db.get("users", identity.userId),
      ledger: await ctx.db.query("creditTransactions").collect(),
    }));
  return { t, owner, identity, receipt, fileId: grant.state.fileId, read };
}

describe("native Nina deletion lifecycle", () => {
  it("deletes the share token in the transaction that deletes its chat", async () => {
    const { t, owner, receipt } = await fixture();
    const shares = () => t.query((ctx) => ctx.db.query("chatShares").collect());
    await owner.mutation(share, {
      chatId: receipt.chatId,
      visibility: "public",
    });
    expect(await shares()).toHaveLength(1);
    await owner.mutation(remove, { chatId: receipt.chatId });
    // Before any scheduled cleanup has run.
    expect(await shares()).toEqual([]);
  });
  it("deletes the share token of a chat that account cleanup removes", async () => {
    const { t, owner, identity, receipt } = await fixture();
    await owner.mutation(share, {
      chatId: receipt.chatId,
      visibility: "public",
    });
    await t.mutation((ctx) =>
      ctx.db.patch(
        "users",
        identity.userId,
        createDeletedUserTombstone(identity.userId, NOW)
      )
    );
    for (let batch = 0; batch < 20; batch += 1) {
      if (!(await t.mutation(cleanup, { userId: identity.userId }))) {
        break;
      }
    }
    vi.runAllTimers();
    await vi.dynamicImportSettled();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await t.query((ctx) => ctx.db.get("chats", receipt.chatId))
    ).toBeNull();
    expect(
      await t.query((ctx) => ctx.db.query("chatShares").collect())
    ).toEqual([]);
  });
  it("deletes a chat whose active turn was already removed", async () => {
    const { t, owner, receipt } = await fixture();
    await t.mutation((ctx) => ctx.db.delete("ninaTurns", receipt.turnId));
    await owner.mutation(remove, { chatId: receipt.chatId });
    expect(
      await t.query((ctx) => ctx.db.get("chats", receipt.chatId))
    ).toBeNull();
  });
  it("keeps every memory when a chat is deleted, the one Nina wrote from that chat and the one the learner wrote", async () => {
    const { t, owner, identity, receipt } = await fixture();
    // A chat that has no active turn, which the trigger handles on its own path.
    const idle = await t.mutation(async (ctx) =>
      ctx.db.insert("chats", {
        threadId: await createThread(ctx, components.nina, {
          userId: identity.userId,
        }),
        type: "study",
        updatedAt: NOW,
        userId: identity.userId,
        visibility: "private",
      })
    );
    expect(
      await t.mutation(capture, {
        candidates: [
          { kind: "level", quote: "aku kelas 12", text: "Kelas 12 IPA." },
        ],
        seen: [],
        topics: [],
        turnId: receipt.turnId,
        userId: identity.userId,
      })
    ).toBe(1);
    await owner.mutation(add, { text: "Written by the learner" });
    const memories = () =>
      t.query((ctx) => ctx.db.query("ninaMemories").collect());
    const before = await memories();
    expect(Arr.map(before, (memory) => memory.author)).toEqual([
      "nina",
      "learner",
    ]);
    for (const chatId of [idle, receipt.chatId]) {
      await owner.mutation(remove, { chatId });
      expect(await t.query((ctx) => ctx.db.get("chats", chatId))).toBeNull();
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
      // `toStrictEqual` compares the sealed bytes of the words too.
      expect(await memories()).toStrictEqual(before);
    }
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
          phase: "settled",
          state: { status: "complete", finishedAt: NOW },
        });
      }
      await ctx.db.insert("ninaSummaries", {
        chatId: receipt.chatId,
        text: await sealedSummary(
          ctx,
          identity.userId,
          "- The learner asked about limits."
        ),
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
    expect(
      Arr.filter(state.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
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

  it("settles a running turn at once when its chat is deleted, and tells its run to halt", async () => {
    const { t, owner, receipt, read } = await fixture();
    await t.mutation(claim, { turnId: receipt.turnId });
    await owner.mutation(remove, { chatId: receipt.chatId });

    // The turn settles in the deleting transaction: the hold comes back without
    // waiting for the run to exit, and the run's next check finds its turn
    // settled.
    const settled = await read();
    expect(settled.turn?.state.status).toBe("cancelled");
    expect(settled.user?.credits).toBe(10);
    expect(
      Arr.filter(settled.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
    expect(await t.query(halted, { turnId: receipt.turnId })).toBe(true);

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const cleaned = await read();
    expect(cleaned.turn).toBeNull();
    expect(cleaned.user?.credits).toBe(10);
    expect(await t.query(halted, { turnId: receipt.turnId })).toBe(true);
  });

  it.each([
    {
      failure: "read",
      fail: () =>
        vi
          .mocked(readThread)
          .mockReturnValue(Effect.fail(new SealedReadError())),
    },
    {
      failure: "cut off",
      fail: () =>
        vi
          .mocked(abortStream)
          .mockRejectedValue(new Error("Private component failure")),
    },
  ])(
    "deletes a chat whose open turn cannot be settled because its journal cannot be $failure, and ends the turn once",
    async ({ fail }) => {
      const { t, owner, receipt, read } = await fixture();
      await t.mutation(claim, { turnId: receipt.turnId });
      fail();

      await owner.mutation(remove, { chatId: receipt.chatId });

      // The delete committed, and the turn ended in its transaction without the
      // journal: the hold came back once.
      const ended = await read();
      expect(ended.chat).toBeNull();
      expect(ended.turn).toMatchObject({
        phase: "settled",
        state: { status: "failed", reason: "unknown" },
      });
      expect(ended.user?.credits).toBe(10);
      expect(
        Arr.filter(ended.ledger, (row) => row.type === "refund")
      ).toHaveLength(1);
      expect(await t.query(halted, { turnId: receipt.turnId })).toBe(true);

      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
      const cleaned = await read();
      expect(cleaned.turn).toBeNull();
      expect(cleaned.user?.credits).toBe(10);
      expect(
        Arr.filter(cleaned.ledger, (row) => row.type === "refund")
      ).toHaveLength(1);
    }
  );

  it("keeps the chat when the hold of its open turn cannot be paid back, so no credit is dropped to free it", async () => {
    const { t, owner, receipt, read } = await fixture();
    await t.mutation(claim, { turnId: receipt.turnId });
    vi.mocked(readThread).mockReturnValue(Effect.fail(new SealedReadError()));
    vi.mocked(resolveEffectiveCreditState).mockImplementation(() =>
      Effect.fail(
        new CreditStateError({
          code: "CREDIT_STATE_FAILED",
          message: "Unable to read or update the credit reset period.",
        })
      )
    );

    await expect(
      owner.mutation(remove, { chatId: receipt.chatId })
    ).rejects.toThrow();

    // The delete rolled back as a whole: the chat, the open turn and the hold
    // stay as they were.
    const kept = await read();
    expect(kept.chat?.activeTurnId).toBe(receipt.turnId);
    expect(kept.turn).toMatchObject({ phase: "active" });
    expect(kept.user?.credits).toBe(5);
  });

  it("keeps the chat, its open turn and the hold when the Agent journal cannot be deleted, so a deleted chat never leaves its words behind", async () => {
    const { t, owner, receipt, read } = await fixture();
    await t.mutation(claim, { turnId: receipt.turnId });
    // The chat names a thread that the Agent component cannot delete, while the
    // open turn still names the real one, so its settlement works.
    await t.mutation((ctx) =>
      ctx.db.patch("chats", receipt.chatId, { threadId: "fixture-thread" })
    );

    await expect(
      owner.mutation(remove, { chatId: receipt.chatId })
    ).rejects.toThrow();

    // Nothing of the delete committed, the end it had made of the open turn
    // included. The learner can try again once the journal can be deleted.
    const kept = await read();
    expect(kept.chat?.activeTurnId).toBe(receipt.turnId);
    expect(kept.turn).toMatchObject({ phase: "active" });
    expect(kept.user?.credits).toBe(5);
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
