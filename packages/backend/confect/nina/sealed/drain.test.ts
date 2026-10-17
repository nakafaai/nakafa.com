import { Ref } from "@confect/core";
import { saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  SEAL_FAILURES_PER_RUN,
  SEAL_RESERVE_BYTES,
  SEAL_TRIES,
} from "@repo/backend/confect/nina/sealed/drain";
import { SEAL_BYTES_PER_SWEEP } from "@repo/backend/confect/nina/sweep";
import { createNinaTest } from "@repo/backend/test/nina";
import {
  drainIn,
  logged,
  settled,
  turnAt,
} from "@repo/backend/test/nina/drain";
import { earlierTurnIn } from "@repo/backend/test/nina/seal";
import { storedRowsIn } from "@repo/backend/test/nina/stored";
import { Array as Arr, MutableRef } from "effect";

vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return { ...actual, saveMessages: vi.fn(actual.saveMessages) };
});

const NOW = Date.UTC(2026, 8, 27, 12);
/** A budget that covers every turn of these tests, however many there are. */
const UNLIMITED = Number.MAX_SAFE_INTEGER;
const seal = Ref.getFunctionReference(refs.internal.nina.sealed.seal);
const recordFailure = Ref.getFunctionReference(
  refs.internal.nina.sealed.recordFailure
);

/**
 * Makes every write of a seal at one of `orders` fail, and passes every other write
 * through. The calls the fixture made before are forgotten, so a test counts the
 * writes of its seals only.
 */
async function failSealsAt(orders: readonly number[]) {
  const actual =
    await vi.importActual<typeof import("@convex-dev/agent")>(
      "@convex-dev/agent"
    );
  vi.mocked(saveMessages).mockClear();
  vi.mocked(saveMessages).mockImplementation((ctx, component, args) =>
    Arr.contains(orders, args.order)
      ? Promise.reject(new Error("The seal is broken for this test"))
      : actual.saveMessages(ctx, component, args)
  );
}

/** Adds `count` tool steps, each with an output of `size` characters, at an order. */
function toolSteps(count: number, size: number, order: number) {
  return Arr.flatMap(
    Arr.makeBy(count, (step) => step),
    (step) => {
      const toolCallId = `drain-${order}-${step}`;
      return [
        {
          role: "assistant" as const,
          content: [
            {
              type: "tool-call" as const,
              toolCallId,
              toolName: "nakafa",
              input: { query: `step ${step}` },
            },
          ],
        },
        {
          role: "tool" as const,
          content: [
            {
              type: "tool-result" as const,
              toolCallId,
              toolName: "nakafa",
              output: { type: "text" as const, value: "x".repeat(size) },
            },
          ],
        },
      ];
    }
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  MutableRef.set(logged, []);
});
afterEach(() => {
  vi.mocked(saveMessages).mockReset();
  vi.useRealTimers();
});

describe("Nina drain seals settled turns within a byte budget", () => {
  it("seals the oldest turn alone under a budget too small for a second one", async () => {
    const f = await createNinaTest({ history: 3, now: NOW });

    await drainIn(f, 0);

    expect(
      Arr.map(await settled(f.t), (turn) => [turn.order, turn.sealed])
    ).toEqual([
      [0, true],
      [1, false],
      [2, false],
    ]);
  });

  it("stops before a seal whose reserve the bytes of the run already leave out of the budget", async () => {
    const f = await createNinaTest({ history: 3, now: NOW });

    // After the first seal the run has counted some bytes, so one more reserve no longer fits.
    await drainIn(f, SEAL_RESERVE_BYTES + 1);

    expect(
      Arr.map(
        Arr.filter(await settled(f.t), (turn) => turn.sealed),
        (turn) => turn.order
      )
    ).toEqual([0]);
  });

  it("seals every settled turn that holds plain rows when the budget covers them", async () => {
    const f = await createNinaTest({ history: 3, now: NOW });

    await drainIn(f, UNLIMITED);

    expect(Arr.map(await settled(f.t), (turn) => turn.sealed)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("seals three short turns within the budget of one sweep run", async () => {
    const f = await createNinaTest({ history: 3, now: NOW });

    await drainIn(f, SEAL_BYTES_PER_SWEEP);

    expect(Arr.map(await settled(f.t), (turn) => turn.sealed)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("counts a failed seal on its turn and logs it, and seals the turns behind it", async () => {
    const f = await createNinaTest({ history: 3, now: NOW });
    const before = await storedRowsIn(f.t, f.threadId, []);
    await failSealsAt([0]);

    await drainIn(f, UNLIMITED);

    const turns = await settled(f.t);
    expect(
      Arr.map(turns, (turn) => [turn.order, turn.sealAttempts, turn.sealed])
    ).toEqual([
      [0, 1, false],
      [1, undefined, true],
      [2, undefined, true],
    ]);
    expect(turns[0]).toMatchObject({ hold: undefined, sealFailedAt: NOW });
    // The failed seal rolled back whole, so the broken turn keeps its plain rows.
    const after = await storedRowsIn(f.t, f.threadId, []);
    const rowsOf = (rows: typeof after.messages.page) =>
      Arr.map(
        Arr.filter(rows, (row) => row.order === 0),
        (row) => row._id
      );
    expect(rowsOf(after.messages.page)).toEqual(rowsOf(before.messages.page));
    expect(MutableRef.get(logged)).toEqual([
      [
        "Nina could not seal a settled turn",
        expect.objectContaining({
          attempts: 1,
          cause: expect.any(String),
          held: false,
          turnId: turns[0]?._id,
        }),
      ],
    ]);
  });

  it("holds a turn after it failed SEAL_TRIES times, so no later run takes it again", async () => {
    const f = await createNinaTest({ history: 2, now: NOW });
    await failSealsAt([0]);

    for (let run = 0; run < SEAL_TRIES + 1; run += 1) {
      await drainIn(f, UNLIMITED);
    }

    const turns = await settled(f.t);
    expect(turns[0]).toMatchObject({
      hold: "failedAttempts",
      sealAttempts: SEAL_TRIES,
      sealed: false,
    });
    expect(turns[1]).toMatchObject({ sealed: true });
    // The seal ran for the broken turn once per try, and never after its hold.
    const triedTurn = Arr.filter(
      vi.mocked(saveMessages).mock.calls,
      ([, , args]) => args.order === 0
    );
    expect(triedTurn).toHaveLength(SEAL_TRIES);
    expect(MutableRef.get(logged)).toHaveLength(SEAL_TRIES);
  });

  it("stops a run after SEAL_FAILURES_PER_RUN failed seals, and leaves the turns behind them to a later run", async () => {
    const turns = SEAL_FAILURES_PER_RUN + 2;
    const f = await createNinaTest({ history: turns, now: NOW });
    await failSealsAt(Arr.makeBy(turns, (order) => order));

    await drainIn(f, UNLIMITED);

    expect(
      Arr.map(await settled(f.t), (turn) => turn.sealAttempts ?? 0)
    ).toEqual([
      ...Arr.makeBy(SEAL_FAILURES_PER_RUN, () => 1),
      ...Arr.makeBy(turns - SEAL_FAILURES_PER_RUN, () => 0),
    ]);
  });

  it("holds the turns whose chat is gone, so the drain passes them by", async () => {
    const f = await createNinaTest({ history: 2, now: NOW });
    await f.t.mutation((ctx) => ctx.db.delete("chats", f.chatId));

    await drainIn(f, UNLIMITED);

    expect(
      Arr.map(await settled(f.t), (turn) => [turn.hold, turn.sealed])
    ).toEqual([
      ["chatDeleted", false],
      ["chatDeleted", false],
    ]);
  });

  it("does nothing when no settled turn holds plain rows", async () => {
    const f = await createNinaTest({ now: NOW });

    await drainIn(f, UNLIMITED);

    expect(await settled(f.t)).toEqual([]);
    expect(MutableRef.get(logged)).toEqual([]);
  });

  it("reads the candidates a page at a time, and seals the turns of every page", async () => {
    const f = await createNinaTest({ history: 11, now: NOW });

    await drainIn(f, UNLIMITED);

    expect(Arr.map(await settled(f.t), (turn) => turn.sealed)).toEqual(
      Arr.makeBy(11, () => true)
    );
  });

  it("logs the cause of each failed seal by its error tag, its error name, or its value", async () => {
    const f = await createNinaTest({ history: 3, now: NOW });
    const actual =
      await vi.importActual<typeof import("@convex-dev/agent")>(
        "@convex-dev/agent"
      );
    vi.mocked(saveMessages).mockClear();
    vi.mocked(saveMessages).mockImplementation((ctx, component, args) => {
      if (args.order === 0) {
        return Promise.reject(new Error("The seal is broken for this test"));
      }
      if (args.order === 1) {
        return Promise.reject("The seal is broken for this test");
      }
      // The component stores the rows at other steps than the seal named.
      return actual.saveMessages(ctx, component, args).then((stored) => ({
        ...stored,
        messages: Arr.map(stored.messages, (row) => ({
          ...row,
          stepOrder: row.stepOrder + 5,
        })),
      }));
    });

    await drainIn(f, UNLIMITED);

    const turns = await settled(f.t);
    expect(MutableRef.get(logged)).toEqual([
      [
        "Nina could not seal a settled turn",
        expect.objectContaining({ cause: "Error", turnId: turns[0]?._id }),
      ],
      [
        "Nina could not seal a settled turn",
        expect.objectContaining({ cause: "unknown", turnId: turns[1]?._id }),
      ],
      [
        "Nina could not seal a settled turn",
        expect.objectContaining({
          cause: "TurnSealError",
          turnId: turns[2]?._id,
        }),
      ],
    ]);
  });

  it("counts a failed seal only on a settled turn that is neither sealed, held nor gone", async () => {
    const f = await createNinaTest({ history: 3, now: NOW });
    const sealed = await turnAt(f.t, 0);
    const held = await turnAt(f.t, 1);
    const gone = await turnAt(f.t, 2);
    await f.t.mutation(seal, { turnId: sealed._id });
    await f.t.mutation((ctx) =>
      ctx.db.patch("ninaTurns", held._id, { sealHold: "chatDeleted" })
    );
    await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", gone._id));
    const count = (turnId: typeof sealed._id) =>
      f.t.mutation(recordFailure, { turnId });

    expect(await count(sealed._id)).toBeNull();
    expect(await count(held._id)).toBeNull();
    expect(await count(gone._id)).toBeNull();
    // The running turn is not settled, so a failure of its seal is not counted.
    expect(await count(f.turnId)).toBeNull();
  });

  it("seals a turn of the longest shape within the reserve of one seal", async () => {
    const f = await createNinaTest({ history: [{ steps: 0 }], now: NOW });
    const turn = await earlierTurnIn(f.t);
    await f.t.mutation(async (ctx) => {
      await saveMessages(ctx, components.nina, {
        messages: toolSteps(20, 24_000, turn.order),
        order: turn.order,
        threadId: f.threadId,
      });
    });

    const cost = await f.t.mutation(seal, { turnId: turn._id });

    expect(cost.bytes).toBeLessThanOrEqual(SEAL_RESERVE_BYTES);
  });
});
