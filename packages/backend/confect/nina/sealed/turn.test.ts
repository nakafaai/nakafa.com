import { Ref } from "@confect/core";
import { saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import { deployment, failures, provider } from "@repo/backend/test/gateway";
import {
  createNinaTest,
  ninaStream,
  ninaToolInput,
  ninaUsage,
} from "@repo/backend/test/nina";
import { contextFor } from "@repo/backend/test/nina/admission";
import {
  earlierTurnIn,
  sealThreadIn,
  withoutRowIds,
} from "@repo/backend/test/nina/seal";
import { readThreadIn } from "@repo/backend/test/nina/sealed";
import { storedRowsIn, storedTextOf } from "@repo/backend/test/nina/stored";
import {
  attachment,
  readyFileIdIn,
  saved,
} from "@repo/backend/test/nina/uploads";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, Record } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));
vi.mock("@repo/backend/confect/nina/nakafa/agent", () => ({
  runNakafaAgent: vi.fn(),
}));
vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));
vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return { ...actual, saveMessages: vi.fn(actual.saveMessages) };
});
vi.mock("@repo/backend/confect/vault/keys", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repo/backend/confect/vault/keys")>();
  return { ...actual, readLearnerKeys: vi.fn(actual.readLearnerKeys) };
});

const NOW = Date.UTC(2026, 8, 27, 12);

/**
 * One text for each place the seal must keep out of the component tables: the
 * learner's message, the reasoning, the answer, a tool input, a tool output and a
 * source (ADR 0024), and the name of the learner's file. Each one is unique, so a
 * search finds only its own place.
 */
const PLANTED = {
  answer: "planted-answer-5c1e",
  file: "planted-file-4a8c",
  input: "planted-tool-input-3b9d",
  output: "planted-tool-output-8a2f",
  prompt: "planted-prompt-0e7a",
  reasoning: "planted-reasoning-6d4c",
  source: "planted-source-9f21",
};

const start = Ref.getFunctionReference(refs.public.nina.turns.start);
const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const seal = Ref.getFunctionReference(refs.internal.nina.sealed.seal);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const readChat = Ref.getFunctionReference(refs.public.nina.messages.page);

/** The planted texts that a stored value holds, in the order of `PLANTED`. */
function plantedIn(value: unknown) {
  const text = storedTextOf(value);
  return Arr.filter(Record.values(PLANTED), (planted) =>
    text.includes(planted)
  );
}

/**
 * A model that calls the `nakafa` tool with a planted input, then answers with
 * planted reasoning, a planted answer and a planted source.
 */
function plantedModel() {
  return new MockLanguageModelV4({
    doStream: [
      ninaStream([
        { type: "stream-start", warnings: [] },
        {
          type: "tool-call",
          toolCallId: "read-1",
          toolName: "nakafa",
          input: encodeJsonText({ ...ninaToolInput, request: PLANTED.input }),
        },
        {
          type: "finish",
          usage: ninaUsage,
          finishReason: { unified: "tool-calls", raw: "tool-calls" },
        },
      ]),
      ninaStream([
        { type: "stream-start", warnings: [] },
        { type: "reasoning-start", id: "reason" },
        { type: "reasoning-delta", id: "reason", delta: PLANTED.reasoning },
        { type: "reasoning-end", id: "reason" },
        { type: "text-start", id: "answer" },
        { type: "text-delta", id: "answer", delta: PLANTED.answer },
        { type: "text-end", id: "answer" },
        {
          type: "source",
          sourceType: "url",
          id: "source-1",
          url: `https://example.com/${PLANTED.source}`,
          title: PLANTED.source,
        },
        {
          type: "finish",
          usage: ninaUsage,
          finishReason: { unified: "stop", raw: "stop" },
        },
      ]),
    ],
  });
}

/**
 * A learner who asks one question through `turns.start`, the admission a learner
 * uses, so the question is sealed as it is in production. The receipt names the
 * chat, the thread, the turn and the prompt.
 */
async function askedIn(text: string) {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, credits: 10 })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const receipt = Ref.decodeReturnsSync(
    refs.public.nina.turns.start,
    await owner.mutation(start, {
      input: {
        kind: "message",
        page: { locale: "en", slug: "home" },
        prompt: { text },
      },
      requestId: "seal-request",
    })
  );
  const turn = () => t.query((ctx) => ctx.db.get("ninaTurns", receipt.turnId));
  /** When the seal ran, or undefined while the turn is open or still plain. */
  const sealedAt = async () => {
    const found = await turn();
    return found?.phase === "settled" ? found.sealedAt : undefined;
  };
  return { owner, receipt, sealedAt, t, turn, userId: identity.userId };
}

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
  // Only the clock is faked: the delta writer and the scheduler keep real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.mocked(resolveNinaContext).mockReturnValue(contextFor("home"));
});
afterEach(() => {
  vi.restoreAllMocks();
  deployment.mockReset();
  provider.languageModel.mockReset();
  vi.useRealTimers();
});

describe("Sealing a settled Nina turn", () => {
  it("leaves no planted text in any component table once the turn settles, and the learner reads the chat unchanged", async () => {
    provider.languageModel.mockReturnValue(plantedModel());
    vi.mocked(runNakafaAgent).mockImplementation(() =>
      Effect.succeed({ text: PLANTED.output })
    );
    const f = await askedIn(PLANTED.prompt);
    // The file keeps its sealed name in the files table, sent by a turn or not.
    const uploadId = await saved(f.owner, {
      ...attachment,
      filename: `${PLANTED.file}.png`,
    });
    const fileId = await readyFileIdIn(f.t, uploadId);
    await f.t.action(run, { turnId: f.receipt.turnId });

    // During the turn the planted texts sit in the plain rows and the deltas. The message
    // is sealed at admission and the file name at upload, so neither is in a table.
    const during = await storedRowsIn(f.t, f.receipt.threadId, [fileId]);
    expect(plantedIn(during)).toEqual(
      expect.arrayContaining([
        PLANTED.answer,
        PLANTED.input,
        PLANTED.output,
        PLANTED.reasoning,
        PLANTED.source,
      ])
    );
    expect(plantedIn(during)).not.toContain(PLANTED.prompt);
    expect(plantedIn(during)).not.toContain(PLANTED.file);
    const streamIds = Arr.map(during.streams, (stream) => stream.streamId);
    const shapeBefore = Arr.map(
      during.messages.page,
      ({ message, order, status, stepOrder, tool }) => ({
        order,
        role: message?.role ?? null,
        status,
        stepOrder,
        tool: tool ?? false,
      })
    );
    const learnerBefore = await f.owner.query(readChat, {
      chatId: f.receipt.chatId,
      paginationOpts: { cursor: null, numItems: 50 },
      threadId: f.receipt.threadId,
    });
    const readerBefore = await readThreadIn(f.t, {
      owner: f.userId,
      paginationOpts: { cursor: null, numItems: 50 },
      threadId: f.receipt.threadId,
    });

    await f.t.finishAllScheduledFunctions(() => undefined);

    const settled = await storedRowsIn(f.t, f.receipt.threadId, [fileId]);
    expect(plantedIn(settled)).toEqual([]);
    expect(settled.files).toEqual([
      expect.objectContaining({ mediaType: "image/png" }),
    ]);
    const deltas = await f.t.query((ctx) =>
      ctx.runQuery(components.nina.streams.listDeltas, {
        cursors: Arr.map(streamIds, (streamId) => ({ cursor: 0, streamId })),
        threadId: f.receipt.threadId,
      })
    );
    expect(plantedIn(deltas)).toEqual([]);
    expect(settled.streams).toEqual([]);

    // The rows keep their order, their steps, their status and their tool flag.
    expect(
      Arr.map(
        settled.messages.page,
        ({ message, order, status, stepOrder, tool }) => ({
          order,
          role: message?.role ?? null,
          status,
          stepOrder,
          tool: tool ?? false,
        })
      )
    ).toEqual(shapeBefore);
    const answers = Arr.filter(
      settled.messages.page,
      (row) => row.message?.role === "assistant"
    );
    expect(answers.length).toBeGreaterThan(0);
    for (const row of answers) {
      expect(row.message?.providerOptions?.nakafa).toBeDefined();
    }

    const learnerAfter = await f.owner.query(readChat, {
      chatId: f.receipt.chatId,
      paginationOpts: { cursor: null, numItems: 50 },
      threadId: f.receipt.threadId,
    });
    expect(withoutRowIds(learnerAfter.page)).toEqual(
      withoutRowIds(learnerBefore.page)
    );
    // The module's own reader opens the sealed rows to the same messages it read plain.
    const readerAfter = await readThreadIn(f.t, {
      owner: f.userId,
      paginationOpts: { cursor: null, numItems: 50 },
      threadId: f.receipt.threadId,
    });
    expect(withoutRowIds(readerAfter.page)).toEqual(
      withoutRowIds(readerBefore.page)
    );
    expect(await f.sealedAt()).toEqual(expect.any(Number));
  });

  it("seals a failed turn, and keeps its failed prompt free of the planted text", async () => {
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doStream: ninaStream([{ type: "error", error: failures.unknown }]),
      })
    );
    const f = await askedIn(PLANTED.prompt);
    await f.t.action(run, { turnId: f.receipt.turnId });
    await f.t.finishAllScheduledFunctions(() => undefined);

    expect(await f.turn()).toMatchObject({
      sealedAt: expect.any(Number),
      state: { status: "failed" },
    });
    expect(plantedIn(await storedRowsIn(f.t, f.receipt.threadId, []))).toEqual(
      []
    );
  });

  it("seals a cancelled turn, and keeps its prompt failed as settlement left it", async () => {
    const f = await askedIn(PLANTED.prompt);
    await f.owner.mutation(cancel, { chatId: f.receipt.chatId });
    await f.t.finishAllScheduledFunctions(() => undefined);

    expect(await f.turn()).toMatchObject({
      sealedAt: expect.any(Number),
      state: { status: "cancelled" },
    });
    const stored = await storedRowsIn(f.t, f.receipt.threadId, []);
    expect(plantedIn(stored)).toEqual([]);
    expect(stored.messages.page).toEqual([
      expect.objectContaining({
        _id: f.receipt.promptMessageId,
        error: "cancelled",
        status: "failed",
      }),
    ]);
  });

  it("does nothing again when a retried seal finds the turn sealed", async () => {
    provider.languageModel.mockReturnValue(plantedModel());
    vi.mocked(runNakafaAgent).mockImplementation(() =>
      Effect.succeed({ text: PLANTED.output })
    );
    const f = await askedIn(PLANTED.prompt);
    await f.t.action(run, { turnId: f.receipt.turnId });
    await f.t.finishAllScheduledFunctions(() => undefined);
    const first = await storedRowsIn(f.t, f.receipt.threadId, []);
    const sealedAt = await f.sealedAt();

    await f.t.mutation(seal, { turnId: f.receipt.turnId });

    const second = await storedRowsIn(f.t, f.receipt.threadId, []);
    expect(Arr.map(second.messages.page, (row) => row._id)).toEqual(
      Arr.map(first.messages.page, (row) => row._id)
    );
    expect(await f.sealedAt()).toBe(sealedAt);
  });

  it("leaves a turn alone whose chat was deleted before its seal ran", async () => {
    provider.languageModel.mockReturnValue(plantedModel());
    vi.mocked(runNakafaAgent).mockImplementation(() =>
      Effect.succeed({ text: PLANTED.output })
    );
    const f = await askedIn(PLANTED.prompt);
    await f.t.action(run, { turnId: f.receipt.turnId });
    await f.t.mutation((ctx) => ctx.db.delete("chats", f.receipt.chatId));
    await f.t.finishAllScheduledFunctions(() => undefined);

    expect(await f.sealedAt()).toBeUndefined();
    const stored = await storedRowsIn(f.t, f.receipt.threadId, []);
    expect(plantedIn(stored)).toEqual(
      expect.arrayContaining([PLANTED.answer, PLANTED.output])
    );
  });

  it("leaves a turn alone whose learner's account was deleted", async () => {
    const f = await askedIn(PLANTED.prompt);
    await f.owner.mutation(cancel, { chatId: f.receipt.chatId });
    await f.t.mutation((ctx) =>
      ctx.db.patch("users", f.userId, { deletedAt: NOW })
    );
    await f.t.finishAllScheduledFunctions(() => undefined);

    expect(await f.sealedAt()).toBeUndefined();
  });

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

  it("does nothing for a turn that was deleted before its seal ran", async () => {
    const f = await askedIn(PLANTED.prompt);
    await f.owner.mutation(cancel, { chatId: f.receipt.chatId });
    await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", f.receipt.turnId));

    await f.t.mutation(seal, { turnId: f.receipt.turnId });

    expect(await f.turn()).toBeNull();
  });

  it("leaves a turn alone whose prompt is gone", async () => {
    const f = await askedIn(PLANTED.prompt);
    await f.owner.mutation(cancel, { chatId: f.receipt.chatId });
    await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.messages.deleteByIds, {
        messageIds: [f.receipt.promptMessageId],
      })
    );

    await f.t.mutation(seal, { turnId: f.receipt.turnId });

    expect(await f.sealedAt()).toBeUndefined();
  });

  it("leaves a turn alone whose learner's account is gone", async () => {
    const f = await askedIn(PLANTED.prompt);
    await f.owner.mutation(cancel, { chatId: f.receipt.chatId });
    await f.t.mutation((ctx) => ctx.db.delete("users", f.userId));
    await f.t.finishAllScheduledFunctions(() => undefined);

    expect(await f.sealedAt()).toBeUndefined();
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

  it("seals a turn with no second read of the learner's key, since the prompt's place needs none", async () => {
    const f = await createNinaTest({ history: [{ steps: 1 }], now: NOW });
    // Admission seals the prompt, so the fixture's rows are sealed in place the same way.
    await sealThreadIn(f.t, f.threadId, f.identity.userId);
    const turn = await earlierTurnIn(f.t);
    vi.mocked(readLearnerKeys).mockClear();

    await f.t.mutation(seal, { turnId: turn._id });

    expect(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", turn._id))
    ).toMatchObject({
      sealedAt: expect.any(Number),
    });
    expect(readLearnerKeys).not.toHaveBeenCalled();
  });
});
