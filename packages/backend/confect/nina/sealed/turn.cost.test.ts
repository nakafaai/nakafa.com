import { Ref } from "@confect/core";
import { RegisteredConvexFunction } from "@confect/server";
import { saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { storedBytes } from "@repo/backend/confect/nina/sealed/bytes";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { createNinaTest } from "@repo/backend/test/nina";
import { NOW } from "@repo/backend/test/nina/planted";
import { earlierTurnIn, sealThreadIn } from "@repo/backend/test/nina/seal";
import { storedRowsIn } from "@repo/backend/test/nina/stored";
import { Array as Arr, Effect } from "effect";

vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return { ...actual, saveMessages: vi.fn(actual.saveMessages) };
});
vi.mock("@repo/backend/confect/vault/keys", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repo/backend/confect/vault/keys")>();
  return { ...actual, ensureLearnerKeys: vi.fn(actual.ensureLearnerKeys) };
});

const seal = Ref.getFunctionReference(refs.internal.nina.sealed.seal);

/**
 * Seals the settled turn of a fixture whose component stores the seal's rows as
 * `store` makes it, and checks that the seal is refused and writes nothing (ADR 0024).
 */
async function refusedSeal(store: () => unknown) {
  const f = await createNinaTest({ history: [{ steps: 1 }], now: NOW });
  const turn = await earlierTurnIn(f.t);
  const before = await storedRowsIn(f.t, f.threadId, []);
  await store();

  await expect(f.t.mutation(seal, { turnId: turn._id })).rejects.toThrow();

  expect(await f.t.query((ctx) => ctx.db.get("ninaTurns", turn._id))).toEqual(
    turn
  );
  const after = await storedRowsIn(f.t, f.threadId, []);
  expect(after.messages.page).toEqual(before.messages.page);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("The bytes a seal of a settled Nina turn counts", () => {
  it("counts the bytes it reads and writes, and a sealed turn counts only its own document", async () => {
    const f = await createNinaTest({ history: [{ steps: 2 }], now: NOW });
    const earlier = await earlierTurnIn(f.t);

    const first = await f.t.mutation(seal, { turnId: earlier._id });
    const again = await f.t.mutation(seal, { turnId: earlier._id });

    expect(first.bytes).toBeGreaterThan(again.bytes);
    expect(again.bytes).toBeGreaterThan(0);
  });

  it("pins the bytes of a seal to the documents it reads, the rows it deletes twice and the rows it writes once", async () => {
    const f = await createNinaTest({ history: [{ steps: 1 }], now: NOW });
    const turn = await earlierTurnIn(f.t);
    // A stream of the turn that finished, as a completed turn leaves it. The seal lists
    // it, and deletes its deltas later, so its bytes are counted here.
    await f.t.mutation(async (ctx) => {
      const streamId = await ctx.runMutation(components.nina.streams.create, {
        format: "UIMessageChunk",
        order: turn.order,
        stepOrder: 0,
        threadId: turn.threadId,
        userId: f.identity.userId,
      });
      await ctx.runMutation(components.nina.streams.finish, { streamId });
    });
    const before = await f.t.query(async (ctx) => {
      const [prompt] = await ctx.runQuery(
        components.nina.messages.getMessagesByIds,
        { messageIds: [turn.promptMessageId] }
      );
      const { page } = await ctx.runQuery(
        components.nina.messages.listMessagesByThreadId,
        {
          order: "desc",
          paginationOpts: { cursor: null, numItems: 50 },
          threadId: turn.threadId,
          upToAndIncludingMessageId: turn.promptMessageId,
        }
      );
      const streams = await ctx.runQuery(components.nina.streams.list, {
        startOrder: turn.order,
        statuses: ["streaming", "finished", "aborted"],
        threadId: turn.threadId,
      });
      return {
        chat: await ctx.db.get("chats", f.chatId),
        page,
        prompt,
        streams,
        turn: await ctx.db.get("ninaTurns", turn._id),
      };
    });
    // The seal counts the learner as its reader returns it, which decodes the stored
    // mascot code, so the count can differ from the stored size that ADR 0024 names
    // for each document.
    const user = await f.t.mutation((ctx) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          return yield* reader
            .table("users")
            .get(f.identity.userId)
            .pipe(Effect.orDie);
        }).pipe(
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      )
    );

    const cost = await f.t.mutation(seal, { turnId: turn._id });

    const after = await storedRowsIn(f.t, f.threadId, []);
    const isOwn = (row: { _id: string; order: number }) =>
      row.order === turn.order && row._id !== turn.promptMessageId;
    expect(cost.bytes).toBe(
      storedBytes(before.turn) +
        storedBytes(before.chat) +
        storedBytes(user) +
        storedBytes(before.prompt) +
        storedBytes(before.page) +
        storedBytes(before.streams) +
        2 * storedBytes(Arr.filter(before.page, isOwn)) +
        storedBytes(Arr.filter(after.messages.page, isOwn)) +
        storedBytes({ ...before.turn, sealedAt: NOW })
    );
  });

  it("seals a turn with one read of the learner's key, since the prompt's place needs none", async () => {
    const f = await createNinaTest({ history: [{ steps: 1 }], now: NOW });
    // Admission seals the prompt, so the fixture's rows are sealed in place the same way.
    await sealThreadIn(f.t, f.threadId, f.identity.userId);
    const turn = await earlierTurnIn(f.t);
    vi.mocked(ensureLearnerKeys).mockClear();

    await f.t.mutation(seal, { turnId: turn._id });

    expect(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", turn._id))
    ).toMatchObject({
      sealedAt: expect.any(Number),
    });
    expect(ensureLearnerKeys).toHaveBeenCalledTimes(1);
    expect(ensureLearnerKeys).toHaveBeenCalledWith(f.identity.userId);
  });

  it("writes nothing when the component stores fewer rows than the seal wrote", () =>
    refusedSeal(() => {
      vi.mocked(saveMessages).mockResolvedValueOnce({ messages: [] });
    }));

  it("writes nothing when the component stores the sealed rows at other steps", () =>
    refusedSeal(async () => {
      const actual =
        await vi.importActual<typeof import("@convex-dev/agent")>(
          "@convex-dev/agent"
        );
      // The same rows, stored five steps later than the seal named them.
      vi.mocked(saveMessages).mockImplementationOnce(
        async (ctx, component, args) => {
          const stored = await actual.saveMessages(ctx, component, args);
          return {
            ...stored,
            messages: Arr.map(stored.messages, (row) => ({
              ...row,
              stepOrder: row.stepOrder + 5,
            })),
          };
        }
      );
    }));
});
