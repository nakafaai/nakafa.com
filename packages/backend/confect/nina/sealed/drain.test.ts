import { Ref } from "@confect/core";
import { RegisteredConvexFunction } from "@confect/server";
import { saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  SEAL_RESERVE_BYTES,
  SEAL_TRIES,
} from "@repo/backend/confect/nina/sealed/drain";
import { SEAL_BYTES_PER_SWEEP } from "@repo/backend/confect/nina/sweep";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { createNinaTest } from "@repo/backend/test/nina";
import {
  drainIn,
  failSealsAt,
  logged,
  settled,
  turnAt,
  UNLIMITED,
} from "@repo/backend/test/nina/drain";
import { earlierTurnIn } from "@repo/backend/test/nina/seal";
import { storedRowsIn } from "@repo/backend/test/nina/stored";
import { TEST_ROOT_KEYS } from "@repo/backend/test/vault";
import { Array as Arr, Effect, MutableRef } from "effect";
import { Base64 } from "effect/encoding";

vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return { ...actual, saveMessages: vi.fn(actual.saveMessages) };
});

const NOW = Date.UTC(2026, 8, 27, 12);
const seal = Ref.getFunctionReference(refs.internal.nina.sealed.seal);
const recordFailure = Ref.getFunctionReference(
  refs.internal.nina.sealed.recordFailure
);

/** The messages that `saveMessages` takes, typed by the Agent. */
type Messages = Parameters<typeof saveMessages>[2]["messages"];

/** Adds `count` tool steps, each with an output of `size` characters, at an order. */
function toolSteps(count: number, size: number, order: number): Messages {
  return Arr.flatMap(
    Arr.makeBy(count, (step) => step),
    (step): Messages => {
      const toolCallId = `drain-${order}-${step}`;
      return [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId,
              toolName: "nakafa",
              input: { query: `step ${step}` },
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId,
              toolName: "nakafa",
              output: { type: "text", value: "x".repeat(size) },
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
  vi.unstubAllEnvs();
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

  it("counts a failed seal as one reserve, so the run stops before a seal its budget cannot fit", async () => {
    const f = await createNinaTest({ history: 3, now: NOW });
    await failSealsAt([0]);

    // The failed seal costs one reserve, so a second reserve does not fit the budget.
    await drainIn(f, 2 * SEAL_RESERVE_BYTES - 1);

    expect(
      Arr.map(await settled(f.t), (turn) => [turn.sealAttempts, turn.sealed])
    ).toEqual([
      [1, false],
      [undefined, false],
      [undefined, false],
    ]);
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

  it("reads the candidates a page at a time, and seals the turns of every page", async () => {
    const f = await createNinaTest({ history: 11, now: NOW });

    await drainIn(f, UNLIMITED);

    expect(Arr.map(await settled(f.t), (turn) => turn.sealed)).toEqual(
      Arr.makeBy(11, () => true)
    );
  });

  it("does nothing when no settled turn holds plain rows", async () => {
    const f = await createNinaTest({ now: NOW });

    await drainIn(f, UNLIMITED);

    expect(await settled(f.t)).toEqual([]);
    expect(MutableRef.get(logged)).toEqual([]);
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

describe("Nina drain keeps a broken turn from holding the turns behind it", () => {
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

  it("holds a turn that always fails after SEAL_TRIES runs, and seals the turn behind it in the next run", async () => {
    const f = await createNinaTest({ history: 2, now: NOW });
    await failSealsAt([0]);
    // The budget fits one failed seal and no second one, as the production budget does.
    const budget = 2 * SEAL_RESERVE_BYTES - 1;

    for (let run = 0; run < SEAL_TRIES; run += 1) {
      await drainIn(f, budget);
    }

    expect(
      Arr.map(await settled(f.t), (turn) => [turn.hold, turn.sealed])
    ).toEqual([
      ["failedAttempts", false],
      [undefined, false],
    ]);

    await drainIn(f, budget);

    const turns = await settled(f.t);
    expect(turns[0]).toMatchObject({
      hold: "failedAttempts",
      sealAttempts: SEAL_TRIES,
      sealed: false,
    });
    expect(turns[1]).toMatchObject({ sealed: true });
  });

  it("does not stop a run at any number of failed seals, and seals the turns behind them", async () => {
    const turns = 6;
    const broken = Arr.makeBy(turns - 1, (order) => order);
    const f = await createNinaTest({ history: turns, now: NOW });
    await failSealsAt(broken);

    await drainIn(f, UNLIMITED);

    expect(
      Arr.map(await settled(f.t), (turn) => [turn.sealAttempts, turn.sealed])
    ).toEqual([...Arr.map(broken, () => [1, false]), [undefined, true]]);
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

  it("logs the cause of each failed seal as its error tag or name, and as unknown for a value that is not an error", async () => {
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

  it("counts a turn whose learner's key the ring cannot open as that turn's failure, and never stops the run", async () => {
    const f = await createNinaTest({ history: 3, now: NOW });
    // The learner's key is made under the current root before the ring changes. The ring
    // then holds that root with other bytes, so the key does not open and no root is missing.
    await f.t.mutation((ctx) =>
      Effect.runPromise(
        ensureLearnerKeys(f.identity.userId).pipe(
          Effect.asVoid,
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      )
    );
    vi.stubEnv(
      "VAULT_ROOT_KEYS",
      `test:${Base64.encode(new Uint8Array(32).fill(9))}`
    );

    await drainIn(f, UNLIMITED);

    const turns = await settled(f.t);
    expect(Arr.map(turns, (turn) => [turn.sealAttempts, turn.sealed])).toEqual([
      [1, false],
      [1, false],
      [1, false],
    ]);
    expect(MutableRef.get(logged)).toEqual(
      Arr.map(turns, (turn) => [
        "Nina could not seal a settled turn",
        expect.objectContaining({ cause: "VaultError", turnId: turn._id }),
      ])
    );
  });

  it("stops the run at once when the ring lacks the root key that a learner key names, with one log and no failure on any turn", async () => {
    const f = await createNinaTest({ history: 3, now: NOW });
    // The learner's key is made under the current root, and the ring then holds only the
    // retired root, so the root that the learner's key names is missing from the environment.
    await f.t.mutation((ctx) =>
      Effect.runPromise(
        ensureLearnerKeys(f.identity.userId).pipe(
          Effect.asVoid,
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      )
    );
    // The fixture writes its own rows with the Agent, so the spy counts the drain's writes only.
    vi.mocked(saveMessages).mockClear();
    vi.stubEnv("VAULT_ROOT_KEYS", TEST_ROOT_KEYS.retired);

    await drainIn(f, UNLIMITED);

    // The seal fails before it writes anything, and the run never reaches the next turn.
    expect(vi.mocked(saveMessages)).not.toHaveBeenCalled();
    expect(
      Arr.map(await settled(f.t), (turn) => [turn.sealAttempts, turn.sealed])
    ).toEqual([
      [undefined, false],
      [undefined, false],
      [undefined, false],
    ]);
    expect(MutableRef.get(logged)).toEqual([
      [
        "Nina stopped sealing settled turns: the key ring cannot be read",
        expect.objectContaining({ cause: "SealUnavailable" }),
      ],
    ]);
  });

  it("stops the run at once when the key ring cannot be read, with one log and no failure on any turn", async () => {
    const f = await createNinaTest({ history: 3, now: NOW });
    // The fixture writes its own rows with the Agent, so the spy counts the drain's writes only.
    vi.mocked(saveMessages).mockClear();
    vi.stubEnv("VAULT_ROOT_KEYS", "");

    await drainIn(f, UNLIMITED);

    // The seal fails before it writes anything, and the run never reaches the next turn.
    expect(vi.mocked(saveMessages)).not.toHaveBeenCalled();
    expect(
      Arr.map(await settled(f.t), (turn) => [
        turn.sealAttempts,
        turn.hold,
        turn.sealed,
      ])
    ).toEqual([
      [undefined, undefined, false],
      [undefined, undefined, false],
      [undefined, undefined, false],
    ]);
    expect(MutableRef.get(logged)).toEqual([
      [
        "Nina stopped sealing settled turns: the key ring cannot be read",
        expect.objectContaining({ cause: "SealUnavailable" }),
      ],
    ]);
  });
});
