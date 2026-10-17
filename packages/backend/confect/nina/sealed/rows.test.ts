import { Ref } from "@confect/core";
import { saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { createNinaTest } from "@repo/backend/test/nina";
import { NOW } from "@repo/backend/test/nina/planted";
import { earlierTurnIn, withoutRowIds } from "@repo/backend/test/nina/seal";
import { readThreadIn } from "@repo/backend/test/nina/sealed";
import { storedRowsIn } from "@repo/backend/test/nina/stored";
import { Array as Arr } from "effect";

vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return { ...actual, saveMessages: vi.fn(actual.saveMessages) };
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

describe("Reading and writing the rows of a settled Nina turn", () => {
  it("seals a turn whose rows take more than one page to read", async () => {
    const f = await createNinaTest({ history: [{ steps: 5 }], now: NOW });
    const earlier = await earlierTurnIn(f.t);
    const readBefore = await readThreadIn(f.t, {
      owner: f.identity.userId,
      paginationOpts: { cursor: null, numItems: 50 },
      threadId: f.threadId,
    });

    await f.t.mutation(seal, { turnId: earlier._id });

    expect(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", earlier._id))
    ).toMatchObject({ phase: "settled", sealedAt: expect.any(Number) });
    const readAfter = await readThreadIn(f.t, {
      owner: f.identity.userId,
      paginationOpts: { cursor: null, numItems: 50 },
      threadId: f.threadId,
    });
    expect(withoutRowIds(readAfter.page)).toEqual(
      withoutRowIds(readBefore.page)
    );
  });

  it("seals a turn that wrote no rows above its prompt", async () => {
    const f = await createNinaTest({ history: [{ steps: 0 }], now: NOW });
    const turn = await earlierTurnIn(f.t);
    const stored = await storedRowsIn(f.t, f.threadId, []);
    const above = Arr.filter(
      stored.messages.page,
      (row) => row._id !== turn.promptMessageId
    );
    await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.messages.deleteByIds, {
        messageIds: Arr.map(above, (row) => row._id),
      })
    );

    await f.t.mutation(seal, { turnId: turn._id });

    expect(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", turn._id))
    ).toMatchObject({ sealedAt: expect.any(Number) });
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
