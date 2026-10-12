import { Ref } from "@confect/core";
import { abortStream, listMessages, saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { CreditStateError } from "@repo/backend/confect/credits/spec";
import { resolveEffectiveCreditState } from "@repo/backend/confect/credits/state";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import {
  SETTLE_GRACE,
  TURN_DEADLINE,
} from "@repo/backend/confect/nina/deadline";
import { createNinaTest } from "@repo/backend/test/nina";
import { args, contextFor, start } from "@repo/backend/test/nina/admission";
import { Array as Arr, Duration, Effect } from "effect";

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
const GRACE = Duration.toMillis(SETTLE_GRACE);
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const recover = Ref.getFunctionReference(refs.internal.nina.lifecycle.recover);
const abandon = Ref.getFunctionReference(refs.internal.nina.lifecycle.abandon);
const sweep = Ref.getFunctionReference(refs.internal.nina.lifecycle.sweep);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const remove = Ref.getFunctionReference(refs.public.chats.mutations.deleteChat);

/** A chat whose first turn holds five of the learner's ten credits. */
async function fixture() {
  const seeded = await createNinaTest({ now: NOW });
  const { t, identity } = seeded;
  const inspect = () =>
    t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      chats: await ctx.db.query("chats").collect(),
      turns: await ctx.db.query("ninaTurns").collect(),
      ledger: await ctx.db.query("creditTransactions").collect(),
    }));
  return { ...seeded, inspect };
}

describe("A Nina turn that cannot be settled", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(resolveNinaContext).mockReturnValue(contextFor("home"));
  });
  afterEach(() => {
    vi.mocked(listMessages).mockReset();
    vi.mocked(abortStream).mockReset();
    vi.mocked(resolveEffectiveCreditState).mockReset();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  /** A running turn found by the sweep at its deadline, while the Agent journal cannot be read. */
  async function stranded() {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    vi.mocked(listMessages).mockRejectedValue(
      new Error("Private component failure")
    );
    const found = NOW + DEADLINE + 1;
    vi.setSystemTime(found);
    await f.t.mutation(sweep, {});
    return { ...f, found };
  }

  it("ends after the grace without its journal, so the chat is free again and the hold comes back once", async () => {
    const f = await stranded();

    // The settlement fails each time it is tried. Until then the chat is busy
    // and cannot be deleted, as before the grace existed.
    await expect(
      f.t.mutation(recover, { turnId: f.turnId })
    ).rejects.toMatchObject({ data: { code: "NINA_WRITE_FAILED" } });
    await expect(
      f.owner.mutation(start, { ...args, chatId: f.chatId })
    ).rejects.toMatchObject({ data: { code: "NINA_BUSY" } });
    await expect(
      f.owner.mutation(remove, { chatId: f.chatId })
    ).rejects.toThrow();
    expect((await f.inspect()).chats).toHaveLength(1);

    vi.setSystemTime(f.found + GRACE);
    await f.t.mutation(abandon, { turnId: f.turnId });
    const ended = await f.inspect();
    expect(ended.turns[0]).toMatchObject({
      phase: "settled",
      state: {
        status: "failed",
        finishedAt: f.found + GRACE,
        reason: "unknown",
      },
    });
    expect(ended.user?.credits).toBe(10);
    expect(
      Arr.filter(ended.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
    expect(ended.chats[0]?.activeTurnId).toBeUndefined();

    // The learner can send in the same chat again, still without the journal.
    const next = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, { ...args, chatId: f.chatId })
    );
    expect(next.chatId).toBe(f.chatId);
    expect((await f.inspect()).user?.credits).toBe(5);
  });

  it("ends by itself: the sweep schedules the last try and the scheduler runs it", async () => {
    const f = await stranded();
    // The settlement the sweep scheduled fails, and so does every try after it.
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());

    const state = await f.inspect();
    expect(state.turns[0]).toMatchObject({
      phase: "settled",
      state: { status: "failed", reason: "unknown" },
    });
    expect(
      Arr.filter(state.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
    expect(state.chats[0]?.activeTurnId).toBeUndefined();
  });

  it("lets the learner delete the chat once its turn was ended", async () => {
    const f = await stranded();
    vi.setSystemTime(f.found + GRACE);
    await f.t.mutation(abandon, { turnId: f.turnId });

    await f.owner.mutation(remove, { chatId: f.chatId });
    expect((await f.inspect()).chats).toEqual([]);
  });

  it("ends a turn the learner had stopped as cancelled, at the time of the stop", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    await f.owner.mutation(cancel, { chatId: f.chatId });
    vi.mocked(listMessages).mockRejectedValue(
      new Error("Private component failure")
    );
    vi.setSystemTime(NOW + DEADLINE + GRACE);
    await f.t.mutation(abandon, { turnId: f.turnId });

    const state = await f.inspect();
    expect(state.turns[0]).toMatchObject({
      phase: "settled",
      state: { status: "cancelled", finishedAt: NOW },
    });
    expect(state.user?.credits).toBe(10);
    expect(state.chats[0]?.activeTurnId).toBeUndefined();
  });

  it("still completes a turn whose answer the journal holds", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    await f.t.mutation((ctx) =>
      saveMessages(ctx, components.nina, {
        threadId: f.threadId,
        promptMessageId: f.promptMessageId,
        messages: [{ role: "assistant", content: "The verified limit is 2." }],
        metadata: [{ finishReason: "stop" }],
      })
    );
    vi.setSystemTime(NOW + DEADLINE + GRACE);
    await f.t.mutation(abandon, { turnId: f.turnId });

    const state = await f.inspect();
    expect(state.turns[0]).toMatchObject({ state: { status: "complete" } });
    expect(state.user?.credits).toBe(5);
    expect(Arr.filter(state.ledger, (row) => row.type === "refund")).toEqual(
      []
    );
  });

  it("ends a turn that the journal cannot cut off, and pays the hold back", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    vi.mocked(abortStream).mockRejectedValue(
      new Error("Private component failure")
    );
    vi.setSystemTime(NOW + DEADLINE + GRACE);
    await f.t.mutation(abandon, { turnId: f.turnId });

    const state = await f.inspect();
    expect(state.turns[0]).toMatchObject({
      state: { status: "failed", reason: "unknown" },
    });
    expect(state.user?.credits).toBe(10);
    expect(state.chats[0]?.activeTurnId).toBeUndefined();
  });

  it("changes nothing when the hold cannot be paid back, so no credit is dropped and a later try ends the turn", async () => {
    const f = await stranded();
    const promptStatus = () =>
      f.t.query(async (ctx) => {
        const [prompt] = await ctx.runQuery(
          components.nina.messages.getMessagesByIds,
          { messageIds: [f.promptMessageId] }
        );
        return prompt?.status;
      });
    const before = await promptStatus();
    vi.setSystemTime(f.found + GRACE);

    // The credit state cannot be read, so the refund fails. Ending the turn
    // without it would drop the learner's credits, which no fallback may do.
    // The ending fails as a whole, and the cut-off it had made in the journal
    // is rolled back with it.
    vi.mocked(resolveEffectiveCreditState).mockImplementationOnce(() =>
      Effect.fail(
        new CreditStateError({
          code: "CREDIT_STATE_FAILED",
          message: "Unable to read or update the credit reset period.",
        })
      )
    );
    await expect(
      f.t.mutation(abandon, { turnId: f.turnId })
    ).rejects.toMatchObject({ data: { code: "NINA_CREDIT_IO_FAILED" } });
    const kept = await f.inspect();
    expect(kept.turns[0]).toMatchObject({
      phase: "active",
      state: { status: "running" },
    });
    expect(kept.user?.credits).toBe(5);
    expect(kept.chats[0]?.activeTurnId).toBe(f.turnId);
    expect(Arr.filter(kept.ledger, (row) => row.type === "refund")).toEqual([]);
    expect(await promptStatus()).toBe(before);

    // The next try, which the next sweep schedules, ends the turn and pays the
    // hold back once.
    await f.t.mutation(abandon, { turnId: f.turnId });
    const ended = await f.inspect();
    expect(ended.turns[0]).toMatchObject({
      phase: "settled",
      state: { status: "failed", reason: "unknown" },
    });
    expect(ended.user?.credits).toBe(10);
    expect(
      Arr.filter(ended.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
    expect(ended.chats[0]?.activeTurnId).toBeUndefined();
  });

  it("leaves a turn alone that a try settled meanwhile, and pays nothing back twice", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    vi.setSystemTime(NOW + DEADLINE + 1);
    await f.t.mutation(recover, { turnId: f.turnId });
    vi.setSystemTime(NOW + DEADLINE + GRACE);
    await f.t.mutation(abandon, { turnId: f.turnId });

    const state = await f.inspect();
    expect(state.turns[0]).toMatchObject({
      state: { status: "failed", reason: "interrupted" },
    });
    expect(state.user?.credits).toBe(10);
    expect(
      Arr.filter(state.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
  });
});
