import { Ref } from "@confect/core";
import { Agent, listMessages, listStreams } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { PostHog } from "@posthog/convex";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { refreshSummary } from "@repo/backend/confect/nina/summary";
import { deployment, failures, provider } from "@repo/backend/test/gateway";
import {
  createNinaTest,
  ninaModel,
  ninaStream,
  ninaUsage,
} from "@repo/backend/test/nina";
import { args, contextFor, start } from "@repo/backend/test/nina/admission";
import { createCapturingTest, level } from "@repo/backend/test/nina/capture";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return { ...actual, listMessages: vi.fn(actual.listMessages) };
});

vi.mock("@repo/backend/confect/nina/summary", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/nina/summary")>();
  return { ...actual, refreshSummary: vi.fn(actual.refreshSummary) };
});
// Admission freezes the page facts of a prompt; the stop and resend test needs
// no signed content for them.
vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));

const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const getChat = Ref.getFunctionReference(refs.public.chats.queries.getChat);
const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);

/** A model whose call stays silent until `release` is called, like a long thought. */
function silentModel() {
  let release: () => void = () => undefined;
  let markStarted: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const model = new MockLanguageModelV4({
    doStream: async () => {
      markStarted();
      await gate;
      return ninaStream([
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "answer" },
        { type: "text-delta", id: "answer", delta: "A late answer." },
        { type: "text-end", id: "answer" },
        {
          type: "finish",
          usage: ninaUsage,
          finishReason: { unified: "stop", raw: "stop" },
        },
      ]);
    },
  });
  return { model, release, started };
}

/** A turn whose model is silent, with a reader of everything a run settles. */
async function fixture() {
  const silent = silentModel();
  provider.languageModel.mockReturnValue(silent.model);
  const f = await createNinaTest({ prompt: "Explain a function limit." });
  const inspect = () =>
    f.t.query(async (ctx) => ({
      user: await ctx.db.get("users", f.identity.userId),
      turn: await ctx.db.get("ninaTurns", f.turnId),
      chat: await ctx.db.get("chats", f.chatId),
      ledger: await ctx.db.query("creditTransactions").collect(),
      streams: await listStreams(ctx, components.nina, {
        threadId: f.threadId,
        includeStatuses: ["streaming", "finished", "aborted"],
      }),
      messages: await listMessages(ctx, components.nina, {
        threadId: f.threadId,
        paginationOpts: { cursor: null, numItems: 20 },
      }),
    }));
  /**
   * Waits until the run has called the model. A run that ends before it does,
   * by returning or by failing, ends the test with that outcome, not with a
   * timeout.
   */
  const reachesModel = async (running: Promise<unknown>) => {
    const called = await Promise.race([
      silent.started.then(() => true),
      running.then(() => false),
    ]);
    expect(called, "the run ended before it called the model").toBe(true);
  };
  /** Starts the run and waits until its model call is in flight and its stream is open. */
  const begin = async () => {
    const running = f.t.action(run, { turnId: f.turnId });
    await reachesModel(running);
    expect((await inspect()).streams).toEqual([
      expect.objectContaining({ status: "streaming" }),
    ]);
    return { running };
  };
  return { ...f, ...silent, inspect, begin, reachesModel };
}

/** True when the thread holds an assistant message that counts as an answer. */
function hasAnswer(messages: Awaited<ReturnType<typeof listMessages>>) {
  return Arr.some(
    messages.page,
    (message) =>
      message.message?.role === "assistant" && message.status === "success"
  );
}

describe("Nina response run", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    provider.languageModel.mockReset();
  });

  it("has taken the turn and opened its answer before the model says a word, and stores each stage once it is reached", async () => {
    const f = await fixture();
    try {
      const { running } = await f.begin();

      // The model is called and silent. The learner's page already has what
      // shows the turn as started: it runs, its claim is stored, and its answer
      // is open to be filled. No stage that needs the model is stored yet.
      const waiting = await f.inspect();
      expect(waiting.turn).toMatchObject({
        phase: "active",
        state: { status: "running" },
        timing: { claimedMs: expect.any(Number) },
      });
      expect(waiting.turn?.timing).not.toHaveProperty("progressMs");
      expect(Arr.map(waiting.messages.page, ({ status }) => status)).toContain(
        "pending"
      );

      f.release();
      await running;
      const {
        claimedMs = 0,
        readyMs = 0,
        progressMs = 0,
        tokenMs = 0,
      } = (await f.inspect()).turn?.timing ?? {};
      expect(readyMs).toBeGreaterThanOrEqual(claimedMs);
      expect(progressMs).toBeGreaterThanOrEqual(readyMs);
      expect(tokenMs).toBeGreaterThanOrEqual(progressMs);
      expect(tokenMs).toBeGreaterThan(0);
    } finally {
      f.release();
    }
  }, 30_000);

  it("answers the turn sent right after a stop while the stopped run still winds down, and the late exit changes nothing", async () => {
    vi.mocked(resolveNinaContext).mockReturnValue(contextFor("home"));
    const f = await fixture();
    try {
      const { running } = await f.begin();
      await f.owner.mutation(cancel, { chatId: f.chatId });

      // The next prompt settles the stopped turn and queues its own, and that
      // turn's run needs neither the stopped run to end nor a sweep.
      provider.languageModel.mockReturnValue(ninaModel());
      const next = Ref.decodeReturnsSync(
        refs.public.nina.turns.start,
        await f.owner.mutation(start, {
          ...args,
          chatId: f.chatId,
          requestId: "next",
        })
      );
      await f.t.action(run, { turnId: next.turnId });
      const answered = await f.t.query((ctx) =>
        ctx.db.get("ninaTurns", next.turnId)
      );
      expect(answered?.state.status).toBe("complete");

      // The stopped run exits later and finds its turn settled.
      f.release();
      await running;
      const state = await f.inspect();
      expect(state.turn?.state.status).toBe("cancelled");
      expect(state.chat?.activeTurnId).toBeUndefined();
      expect(state.user?.credits).toBe(5);
      expect(
        Arr.filter(state.ledger, (row) => row.type === "refund")
      ).toHaveLength(1);
    } finally {
      f.release();
    }
  }, 30_000);

  // The run asks about its turn once a second, so these tests wait in real time
  // and get a longer limit than the default.
  it("stops a silent provider call when the learner cancels, and pays back only after the run exits", async () => {
    const report = vi
      .spyOn(PostHog.prototype, "captureException")
      .mockResolvedValue(undefined);
    const f = await fixture();
    try {
      const { running } = await f.begin();

      await f.owner.mutation(cancel, { chatId: f.chatId });
      const stopping = await f.inspect();
      expect(stopping.turn?.state.status).toBe("running");
      expect(stopping.user?.credits).toBe(5);
      expect(stopping.chat?.activeTurnId).toBe(f.turnId);
      expect(stopping.streams).toEqual([
        expect.objectContaining({ status: "aborted" }),
      ]);

      // The model never answered. The run still ends: its watch aborts it.
      await running;
      const stopped = await f.inspect();
      expect(stopped.turn?.state.status).toBe("cancelled");
      expect(stopped.user?.credits).toBe(10);
      expect(stopped.chat?.activeTurnId).toBeUndefined();
      expect(
        Arr.filter(stopped.ledger, (row) => row.type === "refund")
      ).toHaveLength(1);
      // It keeps the stages its run reached before the stop: the run took the
      // turn and was about to call the model, and nothing came back.
      expect(stopped.turn?.timing).toEqual({
        claimedMs: expect.any(Number),
        readyMs: expect.any(Number),
      });
      expect(hasAnswer(stopped.messages)).toBe(false);
      // A stop the learner asked for is not an operational failure.
      expect(report).not.toHaveBeenCalled();
    } finally {
      f.release();
    }
  }, 15_000);

  it("does not report a stop that Agent noticed before the watch did", async () => {
    const report = vi
      .spyOn(PostHog.prototype, "captureException")
      .mockResolvedValue(undefined);
    const f = await fixture();
    try {
      const running = f.t.action(run, { turnId: f.turnId });
      await f.reachesModel(running);
      // The stream is not open yet. Agent finds it stopped when it opens it and
      // ends the generation itself, ahead of the watch's next check.
      await f.owner.mutation(cancel, { chatId: f.chatId });
      await running;

      const stopped = await f.inspect();
      expect(stopped.turn?.state.status).toBe("cancelled");
      expect(stopped.user?.credits).toBe(10);
      expect(hasAnswer(stopped.messages)).toBe(false);
      expect(report).not.toHaveBeenCalled();
    } finally {
      f.release();
    }
  }, 15_000);

  it("reports a settlement that failed after the learner stopped the turn", async () => {
    const report = vi
      .spyOn(PostHog.prototype, "captureException")
      .mockResolvedValue(undefined);
    const f = await fixture();
    const actual =
      await vi.importActual<typeof import("@convex-dev/agent")>(
        "@convex-dev/agent"
      );
    try {
      const { running } = await f.begin();
      // The stop reads the journal once and succeeds. The settlement that the
      // run's exit makes reads it next, and that read fails.
      vi.mocked(listMessages)
        .mockImplementationOnce(actual.listMessages)
        .mockRejectedValueOnce(new Error("Private component failure"));
      await f.owner.mutation(cancel, { chatId: f.chatId });
      await running;

      // The learner's stop hides nothing about the settlement that was lost.
      expect(report).toHaveBeenCalledOnce();
      const stuck = await f.inspect();
      expect(stuck.turn).toMatchObject({
        phase: "active",
        state: { status: "running" },
        cancelRequestedAt: expect.any(Number),
      });
      expect(stuck.user?.credits).toBe(5);
      expect(stuck.chat?.activeTurnId).toBe(f.turnId);
    } finally {
      f.release();
    }
  }, 15_000);
});

/** A turn whose run fails before it answers. */
const failing = () => createNinaTest({ prompt: "Explain a function limit." });
const PRIVATE_DIAGNOSTIC = /private provider diagnostic/;

describe("The Nina response run when generation fails", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.restoreAllMocks();
    deployment.mockReset();
    provider.languageModel.mockReset();
    vi.useRealTimers();
  });

  it.effect.each([
    ["rate-limit", failures["rate-limit"], "provider-busy"],
    ["quota", failures.quota, "service-configuration"],
    ["auth", failures.auth, "service-configuration"],
    ["configuration", failures.configuration, "service-configuration"],
    ["invalid", failures.invalid, "request-rejected"],
    ["too-large", failures["too-large"], "input-too-large"],
    ["timeout", failures.timeout, "response-timeout"],
    ["unavailable", failures.unavailable, "provider-unavailable"],
    ["network", failures.network, "provider-unavailable"],
    ["interrupted", failures.interrupted, "interrupted"],
    ["unknown", failures.unknown, "unknown"],
    [
      "raw provider HTTP 429",
      new APICallError({
        message: "private provider diagnostic",
        url: "https://provider.example.invalid",
        requestBodyValues: {},
        statusCode: 429,
      }),
      "provider-busy",
    ],
  ] as const)(
    "persists a safe reason for a %s stream failure",
    ([, error, reason]) =>
      Effect.gen(function* () {
        provider.languageModel.mockReturnValue(
          new MockLanguageModelV4({
            doStream: ninaStream([{ type: "error", error }]),
          })
        );
        const f = yield* Effect.promise(() => failing());
        yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
        const state = yield* Effect.promise(f.inspect);
        expect(state.turn?.state).toMatchObject({ status: "failed", reason });
        expect(state.user?.credits).toBe(10);
        const page = yield* Effect.promise(() =>
          f.owner.query(
            Ref.getFunctionReference(refs.public.nina.messages.list),
            {
              chatId: f.chatId,
              threadId: f.threadId,
              paginationOpts: { cursor: null, numItems: 20 },
            }
          )
        ).pipe(
          Effect.flatMap((value) =>
            Ref.decodeReturns(refs.public.nina.messages.list, value)
          )
        );
        expect(
          Arr.some(
            page.page,
            (message) =>
              message.metadata?.state.status === "failed" &&
              message.metadata.state.reason === reason
          )
        ).toBe(true);
        expect(encodeJsonText(page)).not.toMatch(PRIVATE_DIAGNOSTIC);
      })
  );

  it("identifies missing Gateway configuration before a provider request", async () => {
    deployment.mockReturnValue(
      Effect.fail(
        new GatewayConfigurationError({
          message: "AI Gateway is not configured.",
        })
      )
    );
    const f = await failing();
    await f.t.action(run, { turnId: f.turnId });
    const state = await f.inspect();
    expect(state.turn?.state).toMatchObject({
      status: "failed",
      reason: "service-configuration",
    });
    expect(state.user?.credits).toBe(10);
    expect(provider.languageModel).not.toHaveBeenCalled();
    // The run took the turn and failed before it had a model to call, so the
    // turn keeps its claim and holds no readiness.
    expect(state.turn?.timing).toEqual({ claimedMs: expect.any(Number) });
  });

  it.effect("refunds a failure before the Agent stream starts", () =>
    Effect.gen(function* () {
      provider.languageModel.mockReturnValue(ninaModel());
      vi.spyOn(Agent.prototype, "streamText").mockRejectedValueOnce(
        failures["rate-limit"]
      );
      const f = yield* Effect.promise(() => failing());
      yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
      const state = yield* Effect.promise(f.inspect);
      expect(state.turn?.state).toMatchObject({
        status: "failed",
        reason: "provider-busy",
      });
      expect(state.user?.credits).toBe(10);
      expect(
        Arr.filter(state.ledger, (row) => row.type === "refund")
      ).toHaveLength(1);
    })
  );
});

describe("The Nina response run and the memory tool", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.restoreAllMocks();
    provider.languageModel.mockReset();
    vi.useRealTimers();
  });

  /** The names of the tools that the model of one whole turn is offered. */
  async function offered({ paused }: { paused: boolean }) {
    const model = ninaModel();
    provider.languageModel.mockReturnValue(model);
    const f = await createMemoryTest({ prompt: "Explain a function limit." });
    if (paused) {
      await f.owner.mutation(pause, { paused: true });
    }
    await f.t.action(run, { turnId: f.turnId });
    expect(model.doStreamCalls).toHaveLength(1);
    return Arr.map(model.doStreamCalls[0]?.tools ?? [], (tool) => tool.name);
  }

  it("offers the model the memory tool with the others", async () => {
    expect(await offered({ paused: false })).toEqual(
      expect.arrayContaining(["nakafa", "deepResearch", "math", "memory"])
    );
  });

  it("leaves the memory tool out for a learner who paused memory, and keeps the others", async () => {
    const names = await offered({ paused: true });
    expect(names).not.toContain("memory");
    expect(names).toEqual(
      expect.arrayContaining(["nakafa", "deepResearch", "math"])
    );
  });
});

describe("The Nina response among its follow-up work", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 10, 12));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    provider.languageModel.mockReset();
    vi.useRealTimers();
  });

  /**
   * A model for a whole turn: it answers the capture call with `level` and
   * answers the suggestions and the title as `ninaModel` does.
   */
  function turnModel() {
    const model = ninaModel();
    const generate = vi.fn<MockLanguageModelV4["doGenerate"]>(
      ({ prompt, responseFormat }) => {
        let text = "Understanding A Function Limit";
        if (encodeJsonText(prompt).includes("# Learner Message")) {
          text = encodeJsonText({ memories: [level] });
        } else if (responseFormat?.type === "json") {
          text = encodeJsonText({
            suggestions: ["How does this relate to continuity?"],
          });
        }
        return Promise.resolve(providerStep([{ type: "text", text }]));
      }
    );
    model.doGenerate = generate;
    provider.languageModel.mockReturnValue(model);
    return generate;
  }

  it("saves a memory beside the suggestions and the title", async () => {
    const f = await createCapturingTest();
    const generate = turnModel();
    await f.t.action(run, { turnId: f.turnId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    expect(generate).toHaveBeenCalledTimes(3);
    expect(await f.turn()).toMatchObject({
      remembered: 1,
      state: { status: "complete" },
      suggestions: ["How does this relate to continuity?"],
    });
    expect(await f.texts()).toEqual(["Kelas 12."]);
    // The title is stored sealed, so it is read the way every reader opens it.
    expect((await f.owner.query(getChat, { chatId: f.chatId })).title).toBe(
      "Understanding A Function Limit"
    );
  });

  it("saves the memory, the suggestions and the title when the summary dies, and raises that failure once they are done", async () => {
    const f = await createCapturingTest();
    const generate = turnModel();
    vi.mocked(refreshSummary).mockReturnValueOnce(
      Effect.die(new Error("Private summary detail"))
    );
    await f.t.action(run, { turnId: f.turnId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    expect(generate).toHaveBeenCalledTimes(3);
    expect(await f.turn()).toMatchObject({
      remembered: 1,
      suggestions: ["How does this relate to continuity?"],
    });
    expect(await f.texts()).toEqual(["Kelas 12."]);
    expect((await f.owner.query(getChat, { chatId: f.chatId })).title).toBe(
      "Understanding A Function Limit"
    );
    // The follow-up action still fails with the summary's cause, so it is reported.
    const failed = Arr.filter(
      await f.t.query((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      ),
      ({ state }) => state.kind === "failed"
    );
    expect(failed).toHaveLength(1);
  });

  it("never costs the turn its answer or its suggestions when the vault is down, and stores neither a memory nor a title in plain text", async () => {
    const f = await createCapturingTest();
    const generate = turnModel();
    vi.stubEnv("VAULT_ROOT_KEYS", "");
    await f.t.action(run, { turnId: f.turnId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    expect(generate).toHaveBeenCalledTimes(3);
    expect(await f.turn()).toMatchObject({
      state: { status: "complete" },
      suggestions: ["How does this relate to continuity?"],
    });
    // A memory and a title are both sealed. Without the vault neither can be
    // sealed, and neither is written as readable text in its place.
    expect(
      (await f.t.query((ctx) => ctx.db.get("chats", f.chatId)))?.title
    ).toBeUndefined();
    expect(await f.stored()).toEqual([]);
  });
});
