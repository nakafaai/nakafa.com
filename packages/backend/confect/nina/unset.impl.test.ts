import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { NinaTurn } from "@repo/backend/confect/nina/turns.spec";
import {
  PAGE_LIMIT,
  type UnsetTable,
} from "@repo/backend/confect/nina/unset.spec";
import { createNinaTest } from "@repo/backend/test/nina";
import { Array as Arr, Predicate, Struct } from "effect";

const unsetModelKey = Ref.getFunctionReference(
  refs.internal.nina.unset.modelKey
);

const NOW = Date.UTC(2026, 9, 12, 12);

type Nina = Awaited<ReturnType<typeof createNinaTest>>;
type Table = typeof UnsetTable.Type;

/**
 * The credit transactions the learner has besides the hold of the active
 * turn, in creation order. The first three hold the key as the code before
 * 10 October 2026 wrote it, and the second also notes a boolean and a null,
 * the other kinds of value that a note can hold. The last one notes a
 * `modelId` that is not a model key, so it is not the key.
 */
const LEDGER = [
  {
    amount: -5,
    balanceAfter: 5,
    metadata: { modelId: "nakafa-lite", phase: "reserved" },
    type: "usage",
  },
  {
    amount: -5,
    balanceAfter: 5,
    metadata: {
      chatId: "chat",
      flagged: true,
      modelId: "nakafa-pro",
      note: null,
      phase: "complete",
      turnId: "turn",
    },
    type: "usage",
  },
  {
    amount: 2,
    balanceAfter: 7,
    metadata: { modelId: "nakafa-lite", reservationId: "turn" },
    type: "refund",
  },
  {
    amount: 10,
    balanceAfter: 10,
    metadata: {
      "previous-balance": 0,
      "previous-reset-at": 1,
      "reset-at": 2,
    },
    type: "daily-grant",
  },
  { amount: 5, balanceAfter: 15, type: "bonus" },
  {
    amount: -5,
    balanceAfter: 5,
    metadata: { modelId: "google/gemini-3.8-flash", phase: "reserved" },
    type: "usage",
  },
] as const;

/**
 * A learner whose chat holds seven turns and whose ledger holds seven credit
 * transactions, stored as the code before 10 October 2026 stored them. The
 * turns at positions 0, 1, 3, 5 and 6 hold the key, in all three phases: the
 * active turn at 0 is the one the fixture queues, with its stop requested.
 * Between them these turns hold every key that a turn can hold (the first test
 * checks that against the schema of the table), the reason of a failed turn,
 * the optional counts of a usage entry and a partial token count. The ledger
 * rows at 1, 2 and 3 hold the key.
 */
async function seeded() {
  const nina = await createNinaTest({ now: NOW });
  const { chatId, identity, t, threadId, turnId } = nina;
  const userId = identity.userId;
  const facts = (order: number) => ({
    chatId,
    order,
    promptMessageId: `prompt-${order}`,
    threadId,
    usage: [],
    userId,
  });
  const complete = { finishedAt: NOW, status: "complete" } as const;
  await t.mutation(async (ctx) => {
    const active = await ctx.db.get("ninaTurns", turnId);
    if (active?.phase !== "active") {
      return Promise.reject(new Error("Fixture turn is not active"));
    }
    const { fingerprint, page, requestId, transactionId } = active;
    const { snapshot, transition } = page.nina;
    await ctx.db.patch("ninaTurns", turnId, {
      cancelRequestedAt: NOW,
      modelId: "nakafa-lite",
      // Any credit transaction will do as the grant that the hold drew from.
      planCreditGrantId: transactionId,
      snapshot,
      state: { startedAt: NOW, status: "running" },
      transition,
    });
    await ctx.db.insert("ninaTurns", {
      ...facts(1),
      credits: 5,
      fingerprint,
      modelId: "nakafa-pro",
      page,
      phase: "settled",
      promptedAt: NOW,
      remembered: 1,
      requestId,
      snapshot,
      state: complete,
      suggestions: ["How does this relate to continuity?"],
      tokens: { input: 12, output: 4, total: 16 },
      transactionId,
      transition,
      usage: [
        {
          agent: "nina",
          cached: 8,
          calls: 1,
          cost: 0.0003,
          input: 12,
          model: "google/gemini-3.5-flash-lite",
          output: 4,
          provider: "gateway",
          reasoning: 2,
        },
      ],
      user: { role: "student" },
    });
    await ctx.db.insert("ninaTurns", {
      ...facts(2),
      phase: "settled",
      state: { finishedAt: NOW, status: "cancelled" },
    });
    await ctx.db.insert("ninaTurns", {
      ...facts(3),
      modelId: "nakafa-lite",
      phase: "settled",
      retryOf: 1,
      state: complete,
      tokens: { total: 9 },
    });
    await ctx.db.insert("ninaTurns", {
      ...facts(4),
      phase: "settled",
      state: complete,
    });
    await ctx.db.insert("ninaTurns", {
      ...facts(5),
      modelId: "nakafa-pro",
      phase: "unanswered",
      state: { status: "unanswered" },
    });
    await ctx.db.insert("ninaTurns", {
      ...facts(6),
      modelId: "nakafa-lite",
      phase: "settled",
      state: { finishedAt: NOW, reason: "provider-busy", status: "failed" },
    });
    for (const row of LEDGER) {
      await ctx.db.insert("creditTransactions", { userId, ...row });
    }
  });
  return nina;
}

/** Every row of both tables, in creation order. */
function snapshot({ t }: Nina) {
  return t.query(async (ctx) => ({
    ledger: await ctx.db.query("creditTransactions").collect(),
    turns: await ctx.db.query("ninaTurns").collect(),
  }));
}

/** One call, as the operator makes it. */
function call(
  { t }: Nina,
  table: Table,
  cursor: string | null,
  numItems: number
) {
  return t.mutation(unsetModelKey, { cursor, numItems, table });
}

/**
 * Calls from the first page on, each with the cursor of the call before,
 * until a call says the table is done.
 */
async function walk(nina: Nina, table: Table, numItems: number) {
  let pages: readonly Awaited<ReturnType<typeof call>>[] = [];
  let cursor: string | null = null;
  let done = false;
  while (!done) {
    const page = await call(nina, table, cursor, numItems);
    pages = Arr.append(pages, page);
    cursor = page.continueCursor;
    done = page.isDone;
  }
  return pages;
}

// Every test builds a Nina fixture, which can take longer than the default limit
// while many test workers share the machine.
describe("nina/unset", { timeout: 15_000 }, () => {
  it("unsets the key on every turn that holds it, in every phase, and changes nothing else", async () => {
    const nina = await seeded();
    const before = await snapshot(nina);
    expect(Arr.map(before.turns, (turn) => turn.phase)).toEqual([
      "active",
      "settled",
      "settled",
      "settled",
      "settled",
      "unanswered",
      "settled",
    ]);
    expect(Arr.map(before.turns, (turn) => turn.modelId)).toEqual([
      "nakafa-lite",
      "nakafa-pro",
      undefined,
      "nakafa-lite",
      undefined,
      "nakafa-pro",
      "nakafa-lite",
    ]);
    // Between them the turns that hold the key hold every key that a turn can
    // hold, so the comparison below shows that the rewrite keeps each of them.
    const held = Arr.filter(before.turns, Predicate.hasProperty("modelId"));
    const schemaKeys: readonly string[] = Arr.dedupe(
      Arr.flatMap(NinaTurn.members, (member) => Struct.keys(member.fields))
    );
    expect(
      Arr.difference(
        schemaKeys,
        Arr.flatMap(held, (turn) => Struct.keys(turn))
      )
    ).toEqual([]);

    expect(await call(nina, "ninaTurns", null, 10)).toMatchObject({
      changed: 5,
      isDone: true,
      scanned: 7,
    });

    const after = await snapshot(nina);
    expect(Arr.filter(after.turns, Predicate.hasProperty("modelId"))).toEqual(
      []
    );
    // Each turn is the one it was: the same id, creation time and fields.
    expect(after.turns).toEqual(
      Arr.map(before.turns, (turn) => Struct.omit(turn, ["modelId"]))
    );
    // The call wrote no credit transaction.
    expect(after.ledger).toEqual(before.ledger);
  });

  it("unsets the key from the metadata of the credit transactions that hold it and keeps every other note", async () => {
    const nina = await seeded();
    const before = await snapshot(nina);

    expect(await call(nina, "creditTransactions", null, 10)).toMatchObject({
      changed: 3,
      isDone: true,
      scanned: 7,
    });

    const after = await snapshot(nina);
    expect(Arr.map(after.ledger, (row) => row.metadata)).toEqual([
      { phase: "reserved" },
      { phase: "reserved" },
      {
        chatId: "chat",
        flagged: true,
        note: null,
        phase: "complete",
        turnId: "turn",
      },
      { reservationId: "turn" },
      { "previous-balance": 0, "previous-reset-at": 1, "reset-at": 2 },
      undefined,
      { modelId: "google/gemini-3.8-flash", phase: "reserved" },
    ]);
    // The amounts, balances, kinds and owners are the ones that were written.
    expect(
      Arr.map(after.ledger, (row) => Struct.omit(row, ["metadata"]))
    ).toEqual(Arr.map(before.ledger, (row) => Struct.omit(row, ["metadata"])));
    // The call wrote no turn.
    expect(after.turns).toEqual(before.turns);
  });

  it("changes nothing on a second full pass over both tables", async () => {
    const nina = await seeded();
    const first = [
      ...(await walk(nina, "ninaTurns", 3)),
      ...(await walk(nina, "creditTransactions", 3)),
    ];
    expect(Arr.map(first, (page) => page.changed)).toEqual([2, 2, 1, 2, 1, 0]);
    const settled = await snapshot(nina);

    const second = [
      ...(await walk(nina, "ninaTurns", 3)),
      ...(await walk(nina, "creditTransactions", 3)),
    ];
    expect(Arr.map(second, (page) => page.changed)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(Arr.map(second, (page) => page.scanned)).toEqual([3, 3, 1, 3, 3, 1]);
    expect(await snapshot(nina)).toEqual(settled);
  });

  it.each(["ninaTurns", "creditTransactions"] as const)(
    "walks every row of %s exactly once, a page after the other in creation order",
    async (table) => {
      const nina = await seeded();
      const pages = await walk(nina, table, 3);

      // Seven rows in pages of three. The rows that hold the key sit at the
      // positions the fixture documents, so each page finds its own: no row is
      // read twice and none is skipped.
      expect(Arr.map(pages, (page) => page.scanned)).toEqual([3, 3, 1]);
      expect(Arr.map(pages, (page) => page.changed)).toEqual(
        table === "ninaTurns" ? [2, 2, 1] : [2, 1, 0]
      );
      expect(Arr.map(pages, (page) => page.isDone)).toEqual([
        false,
        false,
        true,
      ]);
    }
  );

  it.each([0, PAGE_LIMIT + 1])(
    "refuses a page of %s rows and writes nothing",
    async (numItems) => {
      const nina = await seeded();
      const before = await snapshot(nina);
      await expect(call(nina, "ninaTurns", null, numItems)).rejects.toThrow();
      await expect(
        call(nina, "creditTransactions", null, numItems)
      ).rejects.toThrow();
      expect(await snapshot(nina)).toEqual(before);
    }
  );
});
