import { Ref } from "@confect/core";
import { afterEach, expect, it } from "@effect/vitest";
import { PostHog } from "@posthog/convex";
import refs from "@repo/backend/confect/_generated/refs";
import { failures, provider } from "@repo/backend/test/gateway";
import { createNinaTest, ninaStream } from "@repo/backend/test/nina";
import { encodeJsonText } from "@repo/utilities/json";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

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
      const capture = vi
        .spyOn(PostHog.prototype, "captureException")
        .mockResolvedValue(undefined);
      provider.languageModel.mockReturnValue(
        new MockLanguageModelV4({
          doStream: ninaStream([{ type: "error", error }]),
        })
      );
      const f = yield* Effect.promise(() =>
        createNinaTest({ prompt: "private user prompt" })
      );
      yield* Effect.promise(() =>
        f.t.action(Ref.getFunctionReference(refs.internal.nina.response.run), {
          turnId: f.turnId,
        })
      );
      expect(capture).toHaveBeenCalledTimes(1);
      const report = capture.mock.calls[0]?.[1];
      expect(report?.additionalProperties).toMatchObject({
        source: "nina-response",
        gateway_model_id: "google/gemini-3.5-flash-lite",
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
      const capture = vi
        .spyOn(PostHog.prototype, "captureException")
        .mockRejectedValue(new Error("private delivery failure"));
      provider.languageModel.mockImplementation(() => {
        throw new Error("private defect");
      });
      const f = yield* Effect.promise(() => createNinaTest());
      yield* Effect.promise(() =>
        f.t.action(Ref.getFunctionReference(refs.internal.nina.response.run), {
          turnId: f.turnId,
        })
      );
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
