import { Ref } from "@confect/core";
import { saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { TURN_DEADLINE } from "@repo/backend/confect/nina/deadline";
import { failures, provider } from "@repo/backend/test/gateway";
import { createNinaTest, ninaStream } from "@repo/backend/test/nina";
import { stubReport } from "@repo/backend/test/nina/report";
import { encodeJsonText } from "@repo/utilities/json";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { Duration, Effect } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const NOW = Date.UTC(2026, 8, 27, 12);
const DEADLINE = Duration.toMillis(TURN_DEADLINE);
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const recover = Ref.getFunctionReference(refs.internal.nina.lifecycle.recover);
const run = Ref.getFunctionReference(refs.internal.nina.response.run);

afterEach(() => {
  vi.restoreAllMocks();
  provider.languageModel.mockReset();
});

it.effect.each([
  [
    "a classified failure",
    failures["rate-limit"],
    {
      operation: "provider-busy",
      gateway_status_code: 429,
      gateway_retryable: true,
    },
  ],
  [
    "a classified failure that names its gateway type",
    failures.invalid,
    {
      operation: "request-rejected",
      gateway_error_type: "invalid_request_error",
      gateway_status_code: 400,
      gateway_retryable: false,
    },
  ],
  [
    "a raw provider error",
    new APICallError({
      message: "private provider response",
      url: "https://provider.example.invalid",
      requestBodyValues: { prompt: "private prompt" },
      responseBody: "private-secret",
      statusCode: 429,
    }),
    {
      operation: "provider-busy",
      gateway_status_code: 429,
      gateway_retryable: true,
    },
  ],
] as const)(
  "reports the routing facts of %s while redacting the prompt, response and credentials",
  ([, error, facts]) =>
    Effect.gen(function* () {
      const capture = stubReport();
      provider.languageModel.mockReturnValue(
        new MockLanguageModelV4({
          doStream: ninaStream([{ type: "error", error }]),
        })
      );
      const f = yield* Effect.promise(() =>
        createNinaTest({ prompt: "private user prompt" })
      );
      yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
      expect(capture).toHaveBeenCalledTimes(1);
      const report = capture.mock.calls[0]?.[1];
      expect(report?.additionalProperties).toMatchObject({
        source: "nina-response",
        gateway_model_id: "google/gemini-3.8-flash",
        ...facts,
      });
      expect(report?.error).toMatchObject({
        name: `OperationalError(nina-response.${facts.operation})`,
        message: "Operational exception",
      });
      expect(encodeJsonText(report)).not.toContain("private");
      expect(report?.distinctId).toBeUndefined();
    })
);

it.effect(
  "refunds a defect even when exception delivery cannot be queued",
  () =>
    Effect.gen(function* () {
      const capture = stubReport().mockRejectedValue(
        new Error("private delivery failure")
      );
      provider.languageModel.mockImplementation(() => {
        throw new Error("private defect");
      });
      const f = yield* Effect.promise(() => createNinaTest());
      yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
      const saved = yield* Effect.promise(() =>
        f.t.query(async (ctx) => ({
          turn: await ctx.db.get("ninaTurns", f.turnId),
          user: await ctx.db.get("users", f.identity.userId),
        }))
      );
      expect(saved.turn?.state).toMatchObject({
        status: "failed",
        reason: "unknown",
      });
      expect(saved.user?.credits).toBe(10);
      expect(capture.mock.calls[0]?.[1].additionalProperties?.operation).toBe(
        "unknown"
      );
    })
);

describe("The report of a turn whose run was lost", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("names the turn, the reason and how long it was open in the log, tells error tracking the reason and the place, and carries no word of the conversation", async () => {
    const capture = stubReport();
    const logged = vi.spyOn(console, "error").mockImplementation(() => 0);
    const f = await createNinaTest({ now: NOW, prompt: "private user prompt" });
    await f.t.mutation(claim, { turnId: f.turnId });
    // The run died while it wrote part of an answer, which the journal keeps.
    await f.t.mutation((ctx) =>
      saveMessages(ctx, components.nina, {
        threadId: f.threadId,
        promptMessageId: f.promptMessageId,
        messages: [{ role: "assistant", content: "private partial answer" }],
        metadata: [{ finishReason: "length" }],
      })
    );
    vi.setSystemTime(NOW + DEADLINE + 1);
    await f.t.mutation(recover, { turnId: f.turnId });

    expect((await f.inspect()).turn?.state).toMatchObject({
      status: "failed",
      reason: "interrupted",
    });
    expect(capture).toHaveBeenCalledOnce();
    const sent = capture.mock.calls[0]?.[1];
    expect(sent?.additionalProperties).toEqual({
      source: "nina-response",
      operation: "interrupted",
      error_location: "settlement",
    });
    expect(sent?.error).toMatchObject({
      name: "OperationalError(nina-response.interrupted.settlement)",
      message: "Operational exception",
    });
    expect(sent?.distinctId).toBeUndefined();
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "ERROR",
        message: [
          "Nina run was lost",
          {
            turnId: f.turnId,
            openMs: expect.closeTo(DEADLINE + 1, 0),
            source: "nina-response",
            operation: "interrupted",
            error_location: "settlement",
          },
        ],
      })
    );
    expect(encodeJsonText([sent, logged.mock.calls])).not.toContain("private");
  });

  it("ends a lost turn even when its report cannot be queued", async () => {
    stubReport().mockRejectedValue(new Error("private delivery failure"));
    const warned = vi.spyOn(console, "warn").mockImplementation(() => 0);
    const f = await createNinaTest({ now: NOW });
    await f.t.mutation(claim, { turnId: f.turnId });
    vi.setSystemTime(NOW + DEADLINE + 1);
    await f.t.mutation(recover, { turnId: f.turnId });

    // A report that fails must not roll the settlement back: the hold would
    // stay and the chat would stay busy.
    const state = await f.inspect();
    expect(state.turn?.state).toMatchObject({
      status: "failed",
      reason: "interrupted",
    });
    expect(state.user?.credits).toBe(10);
    expect(state.chat?.activeTurnId).toBeUndefined();
    expect(warned).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "WARN",
        message: "Nina diagnostics could not be queued.",
      })
    );
    expect(encodeJsonText(warned.mock.calls)).not.toContain("private");
  });

  it.each([
    ["within its deadline", DEADLINE],
    ["after its deadline", DEADLINE + 1],
  ])(
    "leaves the failure of a run that ends its own turn %s to the run",
    async (_name, openFor) => {
      const capture = stubReport();
      const f = await createNinaTest({ now: NOW });
      await f.t.mutation(claim, { turnId: f.turnId });
      vi.setSystemTime(NOW + openFor);

      // The run's own exit passes the reason it failed with and the stages it
      // reached, as `generation` does. Only a run that came back can do that,
      // so its turn is not lost, and the run reports its failure itself.
      await f.t.mutation(recover, {
        turnId: f.turnId,
        failure: "provider-busy",
        timing: { claimedMs: 1 },
      });

      expect((await f.inspect()).turn?.state).toMatchObject({
        status: "failed",
        reason: "provider-busy",
      });
      expect(capture).not.toHaveBeenCalled();
    }
  );

  it("reports a run that fails after its deadline once, as the run, and not again as a lost run", async () => {
    const capture = stubReport();
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        // The provider fails late: the deadline of the turn passes while the
        // call is open, and the run is still the one that ends its own turn.
        doStream: () => {
          vi.setSystemTime(NOW + DEADLINE + 1);
          return Promise.resolve(
            ninaStream([{ type: "error", error: failures["rate-limit"] }])
          );
        },
      })
    );
    const f = await createNinaTest({ now: NOW });
    await f.t.action(run, { turnId: f.turnId });

    expect((await f.inspect()).turn?.state).toMatchObject({
      status: "failed",
      reason: "provider-busy",
    });
    expect(capture).toHaveBeenCalledOnce();
    // The report is the run's own, with the facts of the gateway, and not the
    // one that a lost run gets.
    expect(capture.mock.calls[0]?.[1].additionalProperties).toEqual({
      source: "nina-response",
      operation: "provider-busy",
      gateway_model_id: "google/gemini-3.8-flash",
      gateway_status_code: 429,
      gateway_retryable: true,
    });
  });
});
