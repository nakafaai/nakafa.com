import { Ref } from "@confect/core";
import { saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
import { storedBytes } from "@repo/backend/confect/nina/sealed/bytes";
import { RUN_LIFETIME_MS } from "@repo/backend/confect/nina/sealed/turn";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { deployment, failures, provider } from "@repo/backend/test/gateway";
import { createNinaTest, ninaStream } from "@repo/backend/test/nina";
import { contextFor } from "@repo/backend/test/nina/admission";
import {
  askedIn,
  NOW,
  PLANTED,
  plantedIn,
  plantedModel,
} from "@repo/backend/test/nina/planted";
import {
  earlierTurnIn,
  sealThreadIn,
  withoutRowIds,
} from "@repo/backend/test/nina/seal";
import { readThreadIn } from "@repo/backend/test/nina/sealed";
import { storedRowsIn } from "@repo/backend/test/nina/stored";
import {
  attachment,
  readyFileIdIn,
  saved,
} from "@repo/backend/test/nina/uploads";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));
vi.mock("@repo/backend/confect/nina/nakafa/agent", () => ({
  runNakafaAgent: vi.fn(),
}));
vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));
vi.mock("@repo/backend/confect/vault/keys", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repo/backend/confect/vault/keys")>();
  return { ...actual, ensureLearnerKeys: vi.fn(actual.ensureLearnerKeys) };
});

const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const seal = Ref.getFunctionReference(refs.internal.nina.sealed.seal);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const readChat = Ref.getFunctionReference(refs.public.nina.messages.page);

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

  it("does nothing for a turn that was deleted before its seal ran", async () => {
    const f = await askedIn(PLANTED.prompt);
    await f.owner.mutation(cancel, { chatId: f.receipt.chatId });
    await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", f.receipt.turnId));

    await f.t.mutation(seal, { turnId: f.receipt.turnId });

    expect(await f.turn()).toBeNull();
  });

  it("leaves a turn alone that is still running", async () => {
    const f = await askedIn(PLANTED.prompt);

    const cost = await f.t.mutation(seal, { turnId: f.receipt.turnId });

    expect(await f.turn()).toMatchObject({ phase: "active" });
    expect(await f.sealedAt()).toBeUndefined();
    expect(cost.bytes).toBeGreaterThan(0);
  });

  it("leaves a turn with a young pending row for a later run, and seals it once that row is gone", async () => {
    const f = await createNinaTest({ history: [{ steps: 1 }], now: NOW });
    const turn = await earlierTurnIn(f.t);
    // A run that still writes its step holds a pending row at the turn's order.
    await f.t.mutation(async (ctx) => {
      await saveMessages(ctx, components.nina, {
        messages: [
          {
            role: "assistant",
            content: [{ type: "text", text: "Still writing." }],
          },
        ],
        metadata: [{ status: "pending" }],
        order: turn.order,
        threadId: f.threadId,
      });
    });
    const before = await storedRowsIn(f.t, f.threadId, []);
    const pending = Arr.filter(
      before.messages.page,
      (row) => row.status === "pending"
    );
    expect(pending).toHaveLength(1);

    const cost = await f.t.mutation(seal, { turnId: turn._id });

    // The seal writes nothing: the turn keeps its record and its rows, and no hold is set.
    expect(cost.bytes).toBeGreaterThan(0);
    expect(await f.t.query((ctx) => ctx.db.get("ninaTurns", turn._id))).toEqual(
      turn
    );
    expect(await storedRowsIn(f.t, f.threadId, [])).toEqual(before);

    // Once the pending row is gone, the next run seals the turn.
    await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.messages.deleteByIds, {
        messageIds: Arr.map(pending, (row) => row._id),
      })
    );
    await f.t.mutation(seal, { turnId: turn._id });
    expect(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", turn._id))
    ).toMatchObject({ sealedAt: expect.any(Number) });
  });

  it("seals a turn whose pending row is older than a run can live, and writes that row as failed", async () => {
    const f = await createNinaTest({ history: [{ steps: 1 }], now: NOW });
    const turn = await earlierTurnIn(f.t);
    // The run that wrote this row died: its pending row stays, and no run follows it.
    await f.t.mutation(async (ctx) => {
      await saveMessages(ctx, components.nina, {
        messages: [
          {
            role: "assistant",
            content: [{ type: "text", text: "Still writing." }],
          },
        ],
        metadata: [{ status: "pending" }],
        order: turn.order,
        threadId: f.threadId,
      });
    });
    vi.setSystemTime(NOW + RUN_LIFETIME_MS + 1);

    await f.t.mutation(seal, { turnId: turn._id });

    expect(
      await f.t.query((ctx) => ctx.db.get("ninaTurns", turn._id))
    ).toMatchObject({ sealedAt: expect.any(Number) });
    const stored = await storedRowsIn(f.t, f.threadId, []);
    expect(Arr.map(stored.messages.page, (row) => row.status)).not.toContain(
      "pending"
    );
    expect(
      Arr.filter(
        stored.messages.page,
        (row) => row.order === turn.order && row.status === "failed"
      )
    ).toHaveLength(1);
  });
});

describe("Sealing a settled Nina turn that the seal skips", () => {
  it("holds a turn whose chat was deleted before its seal ran, and leaves its plain rows", async () => {
    provider.languageModel.mockReturnValue(plantedModel());
    vi.mocked(runNakafaAgent).mockImplementation(() =>
      Effect.succeed({ text: PLANTED.output })
    );
    const f = await askedIn(PLANTED.prompt);
    await f.t.action(run, { turnId: f.receipt.turnId });
    await f.t.mutation((ctx) => ctx.db.delete("chats", f.receipt.chatId));
    await f.t.finishAllScheduledFunctions(() => undefined);

    expect(await f.turn()).toMatchObject({
      sealHold: "chatDeleted",
    });
    expect(await f.sealedAt()).toBeUndefined();
    const stored = await storedRowsIn(f.t, f.receipt.threadId, []);
    expect(plantedIn(stored)).toEqual(
      expect.arrayContaining([PLANTED.answer, PLANTED.output])
    );
  });

  it("holds a turn whose learner's account was deleted, and leaves its plain rows", async () => {
    const f = await askedIn(PLANTED.prompt);
    await f.owner.mutation(cancel, { chatId: f.receipt.chatId });
    await f.t.mutation((ctx) =>
      ctx.db.patch("users", f.userId, { deletedAt: NOW })
    );
    await f.t.finishAllScheduledFunctions(() => undefined);

    expect(await f.turn()).toMatchObject({ sealHold: "accountDeleted" });
    expect(await f.sealedAt()).toBeUndefined();
  });

  it("holds a turn whose prompt is gone", async () => {
    const f = await askedIn(PLANTED.prompt);
    await f.owner.mutation(cancel, { chatId: f.receipt.chatId });
    await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.messages.deleteByIds, {
        messageIds: [f.receipt.promptMessageId],
      })
    );

    await f.t.mutation(seal, { turnId: f.receipt.turnId });

    expect(await f.turn()).toMatchObject({ sealHold: "promptMissing" });
    expect(await f.sealedAt()).toBeUndefined();
  });

  it("holds a turn whose learner's account is gone", async () => {
    const f = await askedIn(PLANTED.prompt);
    await f.owner.mutation(cancel, { chatId: f.receipt.chatId });
    await f.t.mutation((ctx) => ctx.db.delete("users", f.userId));
    await f.t.finishAllScheduledFunctions(() => undefined);

    expect(await f.turn()).toMatchObject({ sealHold: "accountDeleted" });
    expect(await f.sealedAt()).toBeUndefined();
  });
});

describe("The bytes that sealing a settled Nina turn counts", () => {
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
        // The learner counts at the size the database stores (ADR 0024). The raw
        // document holds the mascot as its stored text, not as the decoded object.
        user: await ctx.db.get("users", f.identity.userId),
        page,
        prompt,
        streams,
        turn: await ctx.db.get("ninaTurns", turn._id),
      };
    });

    const cost = await f.t.mutation(seal, { turnId: turn._id });

    const after = await storedRowsIn(f.t, f.threadId, []);
    const isOwn = (row: { _id: string; order: number }) =>
      row.order === turn.order && row._id !== turn.promptMessageId;
    expect(cost.bytes).toBe(
      storedBytes(before.turn) +
        storedBytes(before.chat) +
        storedBytes(before.user) +
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
});
