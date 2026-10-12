import { Ref } from "@confect/core";
import { QueryRunner, RegisteredFunction } from "@confect/server";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import {
  MEMORY_PAUSED,
  runMemory,
} from "@repo/backend/confect/nina/memory/tool";
import { provider } from "@repo/backend/test/gateway";
import {
  appendNinaTurn,
  type createNinaTest,
  ninaRecallModel,
} from "@repo/backend/test/nina";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, String as Str } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const list = Ref.getFunctionReference(refs.public.nina.messages.list);
const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);
const remove = Ref.getFunctionReference(refs.public.nina.memory.remove);
const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const share = Ref.getFunctionReference(
  refs.public.chats.mutations.updateChatVisibility
);
const token = Ref.getFunctionReference(refs.public.chats.queries.getShareToken);

const NOW = Date.UTC(2026, 9, 12, 12);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  provider.languageModel.mockReset();
  vi.useRealTimers();
});

/**
 * What the capability answers for a query, as the learner of the fixture or the
 * learner named, and the words it found, if any. The words are the text of an
 * answer that states no outcome; the capability's note keeps them out of the
 * conversation (see the registry tests).
 */
async function ask(
  f: Awaited<ReturnType<typeof createNinaTest>>,
  query: string,
  userId = f.identity.userId
) {
  const answer = await f.t.action((ctx) =>
    Effect.runPromise(
      runMemory({ query, userId }).pipe(
        Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
      )
    )
  );
  return {
    answer,
    words: answer.outcome === undefined ? answer.text : undefined,
  };
}

/** The refusal of a query by a learner who paused memory, as the typed failure the shared runner answers. */
function refusal(f: Awaited<ReturnType<typeof createNinaTest>>, query: string) {
  return f.t.action((ctx) =>
    Effect.runPromise(
      runMemory({ query, userId: f.identity.userId }).pipe(
        // This search reads without failure, so only the refusal is left to flip.
        Effect.catchTag("MemoryReadError", Effect.die),
        Effect.flip,
        // Only plain data leaves an action.
        Effect.map(({ _tag, reason }) => ({ _tag, reason })),
        Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
      )
    )
  );
}

/**
 * What the capability fails with, as plain data, when the platform answers its
 * search as `lookup` says: the kind of failure, and everything it shows of
 * itself.
 */
function readFailure(
  f: Awaited<ReturnType<typeof createNinaTest>>,
  lookup: () => Promise<unknown>
) {
  return runMemory({ query: "snbt", userId: f.identity.userId }).pipe(
    Effect.flip,
    Effect.map(({ _tag, message, stack }) => ({
      _tag,
      shown: Arr.join([message, stack ?? ""], "\n"),
    })),
    Effect.provide(QueryRunner.layer(lookup))
  );
}

/** The lines of an answer that list a memory, in order. */
function listed(text: string | undefined) {
  return Arr.filter(Str.split(text ?? "", "\n"), Str.startsWith("- "));
}

describe("the memory capability", () => {
  it("finds the best matches for the query, at most six, the newest first, each with the day it was last confirmed", async () => {
    const f = await createMemoryTest();
    for (const day of Arr.range(1, 8)) {
      await f.seed({
        confirmedAt: Date.UTC(2026, 8, day),
        text: `Catatan SNBT hari ${day}`,
      });
    }
    await f.seed({
      confirmedAt: Date.UTC(2026, 8, 20),
      text: "Hobi main gitar",
    });
    const { answer, words } = await ask(f, "snbt");
    expect(answer).not.toHaveProperty("outcome");
    expect(listed(words)).toEqual([
      "- Catatan SNBT hari 8 (2026-09-08)",
      "- Catatan SNBT hari 7 (2026-09-07)",
      "- Catatan SNBT hari 6 (2026-09-06)",
      "- Catatan SNBT hari 5 (2026-09-05)",
      "- Catatan SNBT hari 4 (2026-09-04)",
      "- Catatan SNBT hari 3 (2026-09-03)",
    ]);
  });

  it("finds a memory by its title as well as its words, and writes each as its title and words", async () => {
    const f = await createMemoryTest();
    await f.seed({
      author: "learner",
      confirmedAt: Date.UTC(2026, 8, 1),
      text: "Hari Senin pukul tujuh",
      title: "Jadwal les",
    });
    expect(listed((await ask(f, "jadwal")).words)).toEqual([
      "- Jadwal les: Hari Senin pukul tujuh (2026-09-01)",
    ]);
  });

  it("gives each memory in nearly full, 800 characters, and marks the cut", async () => {
    const f = await createMemoryTest();
    const long = `Catatan ${"panjang ".repeat(240)}`.trim();
    await f.seed({ author: "learner", text: long });
    const [line] = listed((await ask(f, "catatan")).words);
    expect(line).toBe(`- ${long.slice(0, 800)}... (1970-01-01)`);
  });

  it("keeps the words within 1,500 tokens and says that others were left out", async () => {
    const f = await createMemoryTest();
    // Rare characters take about a token each, so six memories of 800
    // characters are far more than the answer may hold.
    const rare = Arr.join(
      Arr.makeBy(760, (index) => String.fromCodePoint(0x4e_00 + index * 3)),
      ""
    );
    await f.fill(6, { text: `snbt ${rare}` });
    const { words } = await ask(f, "snbt");
    expect(words).toContain(
      "Other memories were left out. Ask again with a narrower query to read them.]"
    );
    expect(Arr.length(listed(words))).toBeLessThan(6);
    const inside = Arr.join(
      Arr.takeWhile(
        Arr.drop(Str.split(words ?? "", "\n"), 3),
        (line) => line !== "</memories>"
      ),
      "\n"
    );
    expect(countTextTokens(inside)).toBeLessThanOrEqual(NINA_BUDGET.lookup);
  });

  it("says in one line that nothing was found, marks the run as empty, and leaves nothing for the next step", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Hobi main gitar" });
    const { answer, words } = await ask(f, "tanggal ujian");
    expect(answer).toMatchObject({ outcome: "empty" });
    expect(Arr.length(Str.split(answer.text, "\n"))).toBe(1);
    expect(words).toBeUndefined();
  });

  it("says nothing was found for a learner who has no memory", async () => {
    const f = await createMemoryTest();
    expect((await ask(f, "snbt")).answer).toMatchObject({ outcome: "empty" });
  });

  it("never finds a memory of another learner", async () => {
    const f = await createMemoryTest();
    const other = await f.stranger();
    await f.seed({ text: "Rahasia SNBT mereka", userId: other.userId });
    expect(await ask(f, "snbt")).toMatchObject({
      answer: { outcome: "empty" },
      words: undefined,
    });
    expect(listed((await ask(f, "snbt", other.userId)).words)).toEqual([
      "- Rahasia SNBT mereka (1970-01-01)",
    ]);
  });

  it("finds nothing that Delete all took, though a batch still holds it", async () => {
    const f = await createMemoryTest();
    await f.fill(4, { text: "Catatan snbt" });
    await f.markCleared(2);
    expect(Arr.length(listed((await ask(f, "snbt")).words))).toBe(2);
  });

  it("refuses while memory is paused, as a policy does, with the denial the policy gives", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Mau ikut SNBT 2027" });
    await f.owner.mutation(pause, { paused: true });
    expect(await refusal(f, "snbt")).toMatchObject({
      _tag: "CapabilityDenied",
      reason: MEMORY_PAUSED.reason,
    });
  });

  it.effect(
    "fails as an unreadable search, and shows nothing of the platform's message, when the call is rejected",
    () =>
      Effect.gen(function* () {
        const f = yield* Effect.promise(() => createMemoryTest());
        const error = yield* readFailure(f, () =>
          // The fixture's message holds the learner's words, to show that none survive.
          Promise.reject(new Error("Lookup failed for Mau ikut SNBT 2027"))
        );
        expect(error._tag).toBe("MemoryReadError");
        expect(error.shown).not.toContain("SNBT");
      })
  );

  it.effect(
    "fails the same way when the platform answers what the search does not describe",
    () =>
      Effect.gen(function* () {
        const f = yield* Effect.promise(() => createMemoryTest());
        const error = yield* readFailure(f, () =>
          Promise.resolve({ memories: [], paused: "no" })
        );
        expect(error._tag).toBe("MemoryReadError");
      })
  );

  it("writes nothing: a memory it returns is not thereby confirmed", async () => {
    const f = await createMemoryTest();
    await f.seed({ confirmedAt: 5, text: "Mau ikut SNBT 2027" });
    const stored = await f.stored();
    const keys = await f.keys();
    vi.setSystemTime(NOW + 3_600_000);
    expect(listed((await ask(f, "snbt")).words)).toHaveLength(1);
    // `toStrictEqual` compares the sealed bytes; `toEqual` takes any two buffers for equal.
    expect(await f.stored()).toStrictEqual(stored);
    expect(await f.keys()).toStrictEqual(keys);
  });
});

describe("a turn in which Nina searches what the learner told her", () => {
  const words = "Ujian UTBK 20 Mei 2027.";

  /** Every message of the chat's thread as the component stores it, tool results included. */
  function stored(f: Awaited<ReturnType<typeof createMemoryTest>>) {
    return f.t.query((ctx) =>
      ctx.runQuery(components.nina.messages.listMessagesByThreadId, {
        excludeToolMessages: false,
        order: "asc",
        paginationOpts: { cursor: null, numItems: 50 },
        threadId: f.threadId,
      })
    );
  }

  it("lets her read what she finds in the next step and stores none of its words, so the transcript and the next turn hold none, even after the memory is deleted", async () => {
    // A capability runs under timers of its own, so the clock is real.
    vi.useRealTimers();
    const languageModel = ninaRecallModel("ujian", 2);
    provider.languageModel.mockReturnValue(languageModel);
    const f = await createMemoryTest({ prompt: "Explain a function limit." });
    // Three newer memories fill the turn's list, so the exam date is in front
    // of Nina only when she searches for it.
    const exam = await f.seed({ confirmedAt: 1, text: words });
    await f.seed({ confirmedAt: 2, text: "Suka main gitar." });
    await f.seed({ confirmedAt: 3, text: "Tinggal di Bandung." });
    await f.seed({ confirmedAt: 4, text: "Kelas 12 IPA." });
    await f.t.action(run, { turnId: f.turnId });
    const [first, second] = Arr.map(languageModel.doStreamCalls, (call) =>
      encodeJsonText(call.prompt)
    );
    expect(first).not.toContain(words);
    expect(second).toContain(words);
    // The thread keeps the call and a result, never the words, and neither does
    // the transcript that any reader of a public chat gets.
    const thread = encodeJsonText(await stored(f));
    expect(thread).toContain("recall-1");
    expect(thread).not.toContain(words);
    const transcript = (await f.inspect()).messages.page;
    expect(transcript).toContainEqual(
      expect.objectContaining({
        parts: expect.arrayContaining([
          expect.objectContaining({
            output: { artifacts: [], text: expect.any(String) },
            state: "output-available",
            type: "tool-memory",
          }),
        ]),
      })
    );
    expect(encodeJsonText(transcript)).not.toContain(words);
    // A visitor who reads the shared chat through its link has no more than
    // the learner sees.
    await f.owner.mutation(share, { chatId: f.chatId, visibility: "public" });
    const shareToken = await f.owner.query(token, { chatId: f.chatId });
    assert(shareToken !== null);
    const shared = await f.t.query(list, {
      chatId: f.chatId,
      paginationOpts: { cursor: null, numItems: 20 },
      shareToken,
      threadId: f.threadId,
    });
    expect(encodeJsonText(shared)).toContain("recall-1");
    expect(encodeJsonText(shared)).not.toContain(words);
    // The learner deletes the memory, and the next turn of the chat reads
    // neither the memory nor a copy of it that the thread kept.
    await f.owner.mutation(remove, { id: exam });
    const next = await appendNinaTurn(f, { prompt: "When is my exam?" });
    await f.t.action(run, { turnId: next.turnId });
    const later = encodeJsonText(languageModel.doStreamCalls[2]?.prompt);
    expect(later).toContain("recall-1");
    expect(later).not.toContain(words);
  });
});
