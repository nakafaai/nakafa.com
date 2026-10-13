import { Ref } from "@confect/core";
import {
  abortStream,
  createThread,
  listMessages,
  saveMessage,
} from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import { CreditStateError } from "@repo/backend/confect/credits/spec";
import { resolveEffectiveCreditState } from "@repo/backend/confect/credits/state";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import { TURN_DEADLINE } from "@repo/backend/confect/nina/deadline";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { stubReport } from "@repo/backend/test/nina/report";
import { sealedSummary } from "@repo/backend/test/seal";
import { Array as Arr, DateTime, Duration, Effect } from "effect";

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
    listMessages: vi.fn(actual.listMessages),
  };
});
const NOW = Date.UTC(2026, 8, 27, 12);
const DEADLINE = Duration.toMillis(TURN_DEADLINE);
const start = Ref.getFunctionReference(refs.public.nina.turns.start);
const save = Ref.getFunctionReference(refs.public.nina.uploads.save);
const add = Ref.getFunctionReference(refs.public.nina.memory.add);
const capture = Ref.getFunctionReference(refs.internal.nina.memory.capture);
const remove = Ref.getFunctionReference(refs.public.chats.mutations.deleteChat);
const share = Ref.getFunctionReference(
  refs.public.chats.mutations.updateChatVisibility
);
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const halted = Ref.getFunctionReference(refs.internal.nina.lifecycle.halted);
const cleanup = Ref.getFunctionReference(
  refs.internal.auth.cleanup.cleanupDeletedUser
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(resolveNinaContext).mockReturnValue(
    openNinaLearningSession({
      capturedAt: DateTime.formatIso(DateTime.makeUnsafe(NOW)),
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
  vi.mocked(listMessages).mockReset();
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
  return { t, owner, identity, receipt, fileId: grant.state.fileId };
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
    const { t, owner, identity, receipt } = await fixture();
    await t.mutation(claim, { turnId: receipt.turnId });
    await owner.mutation(remove, { chatId: receipt.chatId });

    // The turn settles in the deleting transaction: the hold comes back without
    // waiting for the run to exit, and the run's next check finds its turn
    // settled.
    const read = () =>
      t.query(async (ctx) => ({
        turn: await ctx.db.get("ninaTurns", receipt.turnId),
        user: await ctx.db.get("users", identity.userId),
        ledger: await ctx.db.query("creditTransactions").collect(),
      }));
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
    ["read", vi.mocked(listMessages)],
    ["cut off", vi.mocked(abortStream)],
  ] as const)(
    "deletes a chat whose open turn cannot be settled because its journal cannot be %s, and ends the turn once",
    async (_failure, journal) => {
      const { t, owner, identity, receipt } = await fixture();
      await t.mutation(claim, { turnId: receipt.turnId });
      journal.mockRejectedValue(new Error("Private component failure"));

      await owner.mutation(remove, { chatId: receipt.chatId });

      // The delete committed, and the turn ended in its transaction without the
      // journal: the hold came back once.
      const read = () =>
        t.query(async (ctx) => ({
          chat: await ctx.db.get("chats", receipt.chatId),
          turn: await ctx.db.get("ninaTurns", receipt.turnId),
          user: await ctx.db.get("users", identity.userId),
          ledger: await ctx.db.query("creditTransactions").collect(),
        }));
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

  describe("when its run was lost", () => {
    let report: ReturnType<typeof stubReport>;

    beforeEach(() => {
      report = stubReport();
    });
    afterEach(() => {
      report.mockRestore();
    });

    it.each([
      {
        name: "nothing for a turn within its deadline",
        openFor: DEADLINE,
        unreadable: false,
        reported: undefined,
      },
      {
        name: "one loss for a turn past its deadline",
        openFor: DEADLINE + 1,
        unreadable: false,
        reported: "interrupted",
      },
      {
        name: "nothing for a turn within its deadline when the journal cannot be read",
        openFor: DEADLINE,
        unreadable: true,
        reported: undefined,
      },
      {
        name: "one loss for a turn past its deadline when the journal cannot be read",
        openFor: DEADLINE + 1,
        unreadable: true,
        reported: "unknown",
      },
    ])(
      "reports $name when the chat is deleted",
      async ({ openFor, unreadable, reported }) => {
        const { owner, receipt, t } = await fixture();
        await t.mutation(claim, { turnId: receipt.turnId });
        if (unreadable) {
          vi.mocked(listMessages).mockRejectedValue(
            new Error("Private component failure")
          );
        }
        vi.setSystemTime(NOW + openFor);

        await owner.mutation(remove, { chatId: receipt.chatId });

        // However the delete ended the turn, a run that no one stopped and that
        // was still not done after its deadline was lost, and it is reported
        // once, so the report does not depend on the journal.
        if (reported === undefined) {
          expect(report).not.toHaveBeenCalled();
          return;
        }
        expect(report).toHaveBeenCalledOnce();
        expect(report.mock.calls[0]?.[1].additionalProperties).toEqual({
          source: "nina-response",
          operation: reported,
          error_location: "settlement",
        });
      }
    );

    it("reports nothing for a turn that the learner had stopped", async () => {
      const { owner, receipt, t } = await fixture();
      await t.mutation(claim, { turnId: receipt.turnId });
      await owner.mutation(cancel, { chatId: receipt.chatId });
      vi.setSystemTime(NOW + DEADLINE + 1);

      await owner.mutation(remove, { chatId: receipt.chatId });

      expect(report).not.toHaveBeenCalled();
    });
  });

  it("keeps the chat when the hold of its open turn cannot be paid back, so no credit is dropped to free it", async () => {
    const { t, owner, identity, receipt } = await fixture();
    await t.mutation(claim, { turnId: receipt.turnId });
    vi.mocked(listMessages).mockRejectedValue(
      new Error("Private component failure")
    );
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
    const kept = await t.query(async (ctx) => ({
      chat: await ctx.db.get("chats", receipt.chatId),
      turn: await ctx.db.get("ninaTurns", receipt.turnId),
      user: await ctx.db.get("users", identity.userId),
    }));
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
