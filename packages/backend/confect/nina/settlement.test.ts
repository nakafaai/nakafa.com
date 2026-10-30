import { Ref } from "@confect/core";
import { saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { readThread } from "@repo/backend/confect/nina/sealed/thread";
import { SealedReadError } from "@repo/backend/confect/nina/sealed.spec";
import { STOP_GRACE } from "@repo/backend/confect/nina/settlement";
import { createNinaTest } from "@repo/backend/test/nina";
import { contextFor } from "@repo/backend/test/nina/admission";
import { sealThreadIn, writtenThreadIn } from "@repo/backend/test/nina/seal";
import { Array as Arr, Duration, Effect } from "effect";

vi.mock("@repo/backend/confect/nina/sealed/thread", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/nina/sealed/thread")>();
  return { ...actual, readThread: vi.fn(actual.readThread) };
});
vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));
const NOW = Date.UTC(2026, 8, 27, 12);
/**
 * When a learner stops a turn after the setup and the claim: Convex runs each
 * mutation after the commits before it, so a stop that a test times comes at a
 * moment of its own.
 */
const STOPPED_AT = NOW + 500;
const start = Ref.getFunctionReference(refs.public.nina.turns.start);
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const recover = Ref.getFunctionReference(refs.internal.nina.lifecycle.recover);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const args = {
  requestId: "next",
  input: {
    kind: "message",
    prompt: { text: "Explain a limit." },
    page: { locale: "en", slug: "home" },
  },
};

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
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
  /** Sets the balance left after the first turn's hold. */
  const setCredits = (credits: number) =>
    t.mutation((ctx) => ctx.db.patch("users", identity.userId, { credits }));
  return { ...seeded, inspect, setCredits };
}

describe("native Nina stop and resend", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(resolveNinaContext).mockReturnValue(contextFor("home"));
  });
  afterEach(() => {
    vi.mocked(readThread).mockReset();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it.each([
    ["exactly one response's credits", 0],
    ["credits to spare", 10],
  ])(
    "settles the turn a learner stopped when they send the next prompt, with %s, so a stop and resend never meets a busy chat",
    async (_balance, leftAfterHold) => {
      // The first turn holds the whole balance it starts with (ten credits), so
      // `leftAfterHold` is what the learner keeps after that hold. With nothing left,
      // the next prompt can only be paid for by the stopped turn's hold coming back
      // first. With more, the new hold must start from the refunded balance and not
      // undo the refund.
      const f = await fixture();
      await f.setCredits(leftAfterHold);
      await f.t.mutation(claim, { turnId: f.turnId });
      vi.setSystemTime(STOPPED_AT);
      await f.owner.mutation(cancel, { chatId: f.chatId });

      // The stop leaves the turn open, its hold taken, until something settles it.
      const stopped = await f.inspect();
      expect(stopped.turns).toEqual([
        expect.objectContaining({
          _id: f.turnId,
          phase: "active",
          state: expect.objectContaining({ status: "running" }),
          cancelRequestedAt: STOPPED_AT,
        }),
      ]);
      expect(stopped.user?.credits).toBe(leftAfterHold);
      expect(stopped.chats[0]?.activeTurnId).toBe(f.turnId);

      vi.setSystemTime(NOW + 1000);
      const next = Ref.decodeReturnsSync(
        refs.public.nina.turns.start,
        await f.owner.mutation(start, { ...args, chatId: f.chatId })
      );
      const admitted = await f.inspect();
      expect(next.chatId).toBe(f.chatId);
      expect(admitted.chats).toHaveLength(1);
      expect(admitted.chats[0]?.activeTurnId).toBe(next.turnId);
      expect(admitted.turns).toHaveLength(2);
      // The turn finished when the learner stopped it, however late it settles.
      expect(admitted.turns[0]).toMatchObject({
        _id: f.turnId,
        phase: "settled",
        state: { status: "cancelled", finishedAt: STOPPED_AT },
      });
      expect(admitted.turns[0]).not.toHaveProperty("cancelRequestedAt");
      expect(admitted.turns[1]).toMatchObject({
        _id: next.turnId,
        phase: "active",
        state: { status: "queued" },
        order: next.order,
      });
      expect(next.order).toBeGreaterThan(0);
      // The next turn waits for nothing of the stopped one: its run is scheduled
      // for the moment of the prompt, not behind the stopped run, its refund or
      // the sweep.
      expect(
        Arr.filter(admitted.jobs, (job) => job.name === "nina/response:run")
      ).toEqual([
        expect.objectContaining({
          args: [{ turnId: next.turnId }],
          scheduledTime: NOW + 1000,
        }),
      ]);
      // The old hold came back once and the new prompt took a hold of its own.
      expect(admitted.user?.credits).toBe(0);
      expect(admitted.ledger).toEqual([
        expect.objectContaining({
          type: "usage",
          amount: -10,
          metadata: expect.objectContaining({
            phase: "cancelled",
            turnId: f.turnId,
          }),
        }),
        expect.objectContaining({
          type: "refund",
          amount: 10,
          balanceAfter: leftAfterHold + 10,
        }),
        expect.objectContaining({
          type: "usage",
          amount: -(leftAfterHold + 10),
          balanceAfter: 0,
          metadata: { phase: "reserved" },
        }),
      ]);

      // The old run exits and the settlement scheduled at the stop fires. Both
      // find the turn settled, so nothing changes and nothing is paid back twice.
      const grace = Duration.toMillis(STOP_GRACE);
      expect(
        Arr.filter(
          admitted.jobs,
          (job) => job.name === "nina/lifecycle:recover"
        )
      ).toEqual([
        expect.objectContaining({
          args: [{ turnId: f.turnId }],
          scheduledTime: STOPPED_AT + grace,
        }),
      ]);
      // The run's exit also carries the stages it reached, and the turn stores
      // none of them: it keeps its claim and no more.
      await f.t.mutation(recover, {
        turnId: f.turnId,
        timing: { readyMs: 1500, progressMs: 4000, tokenMs: 4200 },
      });
      vi.setSystemTime(STOPPED_AT + grace);
      await f.t.mutation(recover, { turnId: f.turnId });
      const settled = await f.inspect();
      expect(settled).toEqual(admitted);
      expect(settled.turns[0]?.timing).toEqual({
        claimedMs: expect.any(Number),
      });
    }
  );

  it("pays nothing back for a hold from an earlier credit period, and grants the new period once", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    await f.owner.mutation(cancel, { chatId: f.chatId });

    // A day later the daily credits have reset. The settlement grants the new
    // period, and the new hold must see that grant instead of making it again.
    vi.setSystemTime(NOW + 86_400_000);
    await f.owner.mutation(start, { ...args, chatId: f.chatId });
    const state = await f.inspect();
    expect(Arr.map(state.ledger, (row) => row.type)).toEqual([
      "usage",
      "daily-grant",
      "refund",
      "usage",
    ]);
    expect(state.ledger[2]).toMatchObject({ type: "refund", amount: 0 });
    expect(state.user?.credits).toBe(0);
  });

  it("settles a stopped turn when the next prompt starts a new chat, so the credits it held are free for that prompt", async () => {
    const f = await fixture();
    await f.setCredits(0);
    await f.t.mutation(claim, { turnId: f.turnId });
    vi.setSystemTime(STOPPED_AT);
    await f.owner.mutation(cancel, { chatId: f.chatId });

    // The stopped turn holds the only credits the learner has, and the next
    // prompt goes to a chat of its own.
    vi.setSystemTime(NOW + 1000);
    const next = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, args)
    );
    const state = await f.inspect();
    expect(next.chatId).not.toBe(f.chatId);
    expect(state.turns).toMatchObject([
      {
        _id: f.turnId,
        phase: "settled",
        state: { status: "cancelled", finishedAt: STOPPED_AT },
      },
      { _id: next.turnId, phase: "active", state: { status: "queued" } },
    ]);
    expect(state.chats[0]?.activeTurnId).toBeUndefined();
    expect(state.chats[1]?.activeTurnId).toBe(next.turnId);
    expect(state.user?.credits).toBe(0);
    expect(Arr.map(state.ledger, (row) => row.type)).toEqual([
      "usage",
      "refund",
      "usage",
    ]);
  });

  it("settles every turn the learner stopped, in whichever chat it ran, and pays each hold back once", async () => {
    const f = await fixture();
    await f.setCredits(10);
    const other = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, { ...args, requestId: "other-chat" })
    );
    await f.t.mutation(claim, { turnId: f.turnId });
    await f.t.mutation(claim, { turnId: other.turnId });
    await f.owner.mutation(cancel, { chatId: f.chatId });
    await f.owner.mutation(cancel, { chatId: other.chatId });

    // Both stopped turns are the learner's two open turns, and each holds five
    // credits. The next prompt settles both before it counts or holds.
    await f.owner.mutation(start, { ...args, requestId: "next" });
    const state = await f.inspect();
    expect(
      Arr.map(state.turns, (turn) => [turn.phase, turn.state.status])
    ).toEqual([
      ["settled", "cancelled"],
      ["settled", "cancelled"],
      ["active", "queued"],
    ]);
    expect(state.user?.credits).toBe(0);
    expect(
      Arr.map(
        Arr.filter(state.ledger, (row) => row.type === "refund"),
        (row) => row.balanceAfter
      )
    ).toEqual([10, 20]);
  });

  it("admits a prompt in a new chat while a stopped turn's journal cannot be read, and settles that turn once it can", async () => {
    const actual = await vi.importActual<
      typeof import("@repo/backend/confect/nina/sealed/thread")
    >("@repo/backend/confect/nina/sealed/thread");
    const f = await fixture();
    await f.setCredits(10);
    const other = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, { ...args, requestId: "other-chat" })
    );
    await f.t.mutation(claim, { turnId: f.turnId });
    await f.t.mutation(claim, { turnId: other.turnId });
    vi.setSystemTime(STOPPED_AT);
    await f.owner.mutation(cancel, { chatId: f.chatId });
    await f.owner.mutation(cancel, { chatId: other.chatId });

    // The journal of the first chat's thread stops answering, so its stopped
    // turn cannot settle. The other chat's stopped turn still can.
    vi.mocked(readThread).mockImplementation((ctx, read) =>
      read.threadId === f.threadId
        ? Effect.fail(new SealedReadError())
        : actual.readThread(ctx, read)
    );
    const next = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, { ...args, requestId: "new-chat" })
    );
    const admitted = await f.inspect();
    expect(Arr.map(admitted.turns, (turn) => [turn._id, turn.phase])).toEqual([
      [f.turnId, "active"],
      [other.turnId, "settled"],
      [next.turnId, "active"],
    ]);
    expect(admitted.user?.credits).toBe(0);
    expect(
      Arr.filter(admitted.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
    expect(admitted.chats[0]?.activeTurnId).toBe(f.turnId);

    // That one chat stays busy, because its thread cannot be used either, and
    // the refusal says so. It does not become a failure to write.
    await expect(
      f.owner.mutation(start, {
        ...args,
        requestId: "same-chat",
        chatId: f.chatId,
      })
    ).rejects.toMatchObject({ data: { code: "NINA_BUSY" } });

    // Once the journal can be read, the next prompt settles the turn at the
    // time of the stop, pays its hold back once and takes the chat.
    vi.mocked(readThread).mockImplementation(actual.readThread);
    const again = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, {
        ...args,
        requestId: "same-chat-again",
        chatId: f.chatId,
      })
    );
    const settled = await f.inspect();
    expect(settled.turns[0]).toMatchObject({
      _id: f.turnId,
      phase: "settled",
      state: { status: "cancelled", finishedAt: STOPPED_AT },
    });
    expect(settled.chats[0]?.activeTurnId).toBe(again.turnId);
    expect(settled.user?.credits).toBe(0);
    expect(
      Arr.filter(settled.ledger, (row) => row.type === "refund")
    ).toHaveLength(2);
  });

  it.each([
    ["in the stopped turn's chat", true],
    ["in a new chat", false],
  ])(
    "settles a stopped turn before it counts the open turns for a prompt %s, so the limit still holds around it",
    async (_where, sameChat) => {
      const f = await fixture();
      await f.setCredits(60);
      await f.t.mutation(claim, { turnId: f.turnId });
      await f.owner.mutation(cancel, { chatId: f.chatId });
      await f.owner.mutation(start, { ...args, requestId: "other-chat" });

      // The stopped turn and the other chat's turn are the two open turns. The
      // next prompt settles the stopped one first, so it fits.
      await f.owner.mutation(start, {
        ...args,
        requestId: "next",
        ...(sameChat ? { chatId: f.chatId } : {}),
      });
      const state = await f.inspect();
      expect(
        Arr.map(state.turns, (turn) => [turn.phase, turn.state.status])
      ).toEqual([
        ["settled", "cancelled"],
        ["active", "queued"],
        ["active", "queued"],
      ]);

      // Two turns are open again, so one more is refused as before.
      await expect(
        f.owner.mutation(start, { ...args, requestId: "third" })
      ).rejects.toMatchObject({ data: { code: "RATE_LIMITED" } });
    }
  );

  it("keeps a chat busy while its running turn was not stopped, and holds no credit for the refused prompt", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    await expect(
      f.owner.mutation(start, { ...args, chatId: f.chatId })
    ).rejects.toMatchObject({ data: { code: "NINA_BUSY" } });
    const state = await f.inspect();
    expect(state.user?.credits).toBe(0);
    expect(state.ledger).toHaveLength(1);
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]).toMatchObject({
      phase: "active",
      state: { status: "running" },
    });
    expect(state.turns[0]).not.toHaveProperty("cancelRequestedAt");
    expect(state.chats[0]?.activeTurnId).toBe(f.turnId);
  });

  it("keeps a chat busy when the turn it points at is gone, and holds no credit", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", f.turnId));
    await expect(
      f.owner.mutation(start, { ...args, chatId: f.chatId })
    ).rejects.toMatchObject({ data: { code: "NINA_BUSY" } });
    const state = await f.inspect();
    expect(state.user?.credits).toBe(0);
    expect(state.ledger).toHaveLength(1);
  });

  it("keeps what the history of its prompt cost on the turn that completes, and drops it with a turn that does not", async () => {
    const history = { tokens: 4200, turns: 3 };
    const unanswered = await fixture();
    await unanswered.t.mutation(claim, { turnId: unanswered.turnId });
    // Nothing answered the prompt, so the turn fails, and a failed turn is never folded.
    await unanswered.t.mutation(recover, {
      history,
      turnId: unanswered.turnId,
    });
    const failed = (await unanswered.inspect()).turns[0];
    expect(failed).toMatchObject({ state: { status: "failed" } });
    expect(failed).not.toHaveProperty("history");

    const answered = await fixture();
    await answered.t.mutation(claim, { turnId: answered.turnId });
    await answered.t.mutation((ctx) =>
      saveMessages(ctx, components.nina, {
        messages: [{ role: "assistant", content: "A limit is a value." }],
        metadata: [{ finishReason: "stop" }],
        promptMessageId: answered.promptMessageId,
        threadId: answered.threadId,
      })
    );
    await answered.t.mutation(recover, { history, turnId: answered.turnId });
    expect((await answered.inspect()).turns[0]).toMatchObject({
      history,
      state: { status: "complete" },
    });
  });

  it("settles a turn whose answer is sealed as one whose answer is plain, with the same history", async () => {
    const history = { tokens: 4200, turns: 3 };
    /** Recovers a turn whose answer is in the journal, plain, written by the writers or sealed in place, and returns what settlement wrote. */
    const settle = async (copy: "plain" | "written" | "sealed") => {
      const f = await fixture();
      await f.t.mutation(claim, { turnId: f.turnId });
      await f.t.mutation((ctx) =>
        saveMessages(ctx, components.nina, {
          messages: [{ role: "assistant", content: "A limit is a value." }],
          metadata: [{ finishReason: "stop" }],
          promptMessageId: f.promptMessageId,
          threadId: f.threadId,
        })
      );
      if (copy !== "plain") {
        await writtenThreadIn(f.t, f.threadId, f.identity.userId);
      }
      if (copy === "sealed") {
        await sealThreadIn(f.t, f.threadId, f.identity.userId);
      }
      await f.t.mutation(recover, { history, turnId: f.turnId });
      const turn = (await f.inspect()).turns[0];
      return { history: turn?.history, phase: turn?.phase, state: turn?.state };
    };
    const plain = await settle("plain");
    expect(await settle("written")).toEqual(plain);
    const sealed = await settle("sealed");
    expect(sealed).toEqual(plain);
    expect(sealed).toMatchObject({ history, state: { status: "complete" } });
  });
});
