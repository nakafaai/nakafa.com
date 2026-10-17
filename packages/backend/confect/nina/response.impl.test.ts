import { Ref } from "@confect/core";
import { QueryRunner } from "@confect/server";
import { Agent } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { turnHalted } from "@repo/backend/confect/nina/halt";
import { refreshSummary } from "@repo/backend/confect/nina/summary";
import { deployment, failures, provider } from "@repo/backend/test/gateway";
import { createNinaTest, ninaModel, ninaStream } from "@repo/backend/test/nina";
import {
  createCapturingTest,
  level,
  MESSAGE,
} from "@repo/backend/test/nina/capture";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { createSilentTest } from "@repo/backend/test/nina/silent";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, Order } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

vi.mock("@repo/backend/confect/nina/summary", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/nina/summary")>();
  return { ...actual, refreshSummary: vi.fn(actual.refreshSummary) };
});

vi.mock("@repo/backend/confect/nina/halt", async (load) => {
  const actual = await load<typeof import("@repo/backend/confect/nina/halt")>();
  return { ...actual, turnHalted: vi.fn(actual.turnHalted) };
});

const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const getChat = Ref.getFunctionReference(refs.public.chats.queries.getChat);
const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);

describe("Nina response run", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    provider.languageModel.mockReset();
  });

  it("has taken the turn and opened its answer before the model says a word, and stores each stage once it is reached", async () => {
    const f = await createSilentTest();
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
    vi.mocked(turnHalted).mockReset();
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
        // `list` is read for the turn metadata that tabs opened before `page`
        // still use. `page` returns no metadata, so this check goes with `list`.
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
        // The turns that ended tell the same failure, and no private diagnostic.
        const turns = yield* Effect.promise(() =>
          f.owner.query(
            Ref.getFunctionReference(refs.public.nina.conversation.turns),
            { chatId: f.chatId, paginationOpts: { cursor: null, numItems: 20 } }
          )
        ).pipe(
          Effect.flatMap((value) =>
            Ref.decodeReturns(refs.public.nina.conversation.turns, value)
          )
        );
        expect(
          Arr.some(
            turns.page,
            (turn) =>
              turn.state.status === "failed" && turn.state.reason === reason
          )
        ).toBe(true);
        expect(encodeJsonText(turns)).not.toMatch(PRIVATE_DIAGNOSTIC);
        // A run that ended badly has no history cost to keep.
        expect(state.turn).not.toHaveProperty("history");
      })
  );

  it("stores the reason the generation failed with when the read that asks whether its turn was halted fails too", async () => {
    const halt = await vi.importActual<
      typeof import("@repo/backend/confect/nina/halt")
    >("@repo/backend/confect/nina/halt");
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doStream: ninaStream([
          { type: "error", error: failures["rate-limit"] },
        ]),
      })
    );
    // The failure handler asks once whether the turn was halted, and that read
    // fails. The watch keeps its own copy of the question and is not affected.
    vi.mocked(turnHalted).mockImplementationOnce((turnId) =>
      halt
        .turnHalted(turnId)
        .pipe(
          Effect.provide(
            QueryRunner.layer(
              vi.fn().mockRejectedValue(new Error("Private connection failure"))
            )
          )
        )
    );
    const f = await failing();
    await f.t.action(run, { turnId: f.turnId });
    const state = await f.inspect();
    expect(state.turn?.state).toMatchObject({
      status: "failed",
      reason: "provider-busy",
    });
    expect(state.user?.credits).toBe(10);
  });

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
    // Settlement schedules the turn's follow-up work (title, suggestions, memory and
    // seal) at zero delay. The test runs it here, so none of it is still pending when
    // the next test advances the clock and finds it.
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
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

  it("keeps the tokens of a summary fold on the summary row and puts none in the ledger of the turn, which every web build decodes by the agent names it was built with", async () => {
    // Six earlier turns of about 6,000 tokens outweigh the history budget, so
    // the turn that settles folds them into the summary. It is not the first
    // turn of its chat, so it gets no title.
    const f = await createCapturingTest(
      MESSAGE,
      Arr.makeBy(6, () => ({ tokens: 6000 }))
    );
    const generate = turnModel();
    await f.t.action(run, { turnId: f.turnId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    // The capture, the suggestions and the fold each asked the model once.
    expect(generate).toHaveBeenCalledTimes(3);
    const agents = Arr.map((await f.turn())?.usage ?? [], ({ agent }) => agent);
    expect(Arr.sort(agents, Order.String)).toEqual([
      "memory",
      "nina",
      "suggestions",
    ]);
    expect(
      await f.t.query((ctx) => ctx.db.query("ninaSummaries").collect())
    ).toEqual([
      expect.objectContaining({ usage: { calls: 1, input: 12, output: 4 } }),
    ]);
  }, 30_000);

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
