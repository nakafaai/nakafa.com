import { GatewayRateLimitError } from "@ai-sdk/gateway";
import { Ref } from "@confect/core";
import { afterEach, expect, it } from "@effect/vitest";
import { PostHog } from "@posthog/convex";
import refs from "@repo/backend/confect/_generated/refs";
import { getGatewayModel } from "@repo/backend/confect/nina/config/provider";
import { createNinaTest, ninaStream } from "@repo/backend/test/nina";
import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/nina/config/provider", async (original) => ({
  ...(await original<
    typeof import("@repo/backend/confect/nina/config/provider")
  >()),
  getGatewayModel: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

it.effect(
  "reports provider routing facts while redacting the prompt, response and credentials",
  () =>
    Effect.gen(function* () {
      const capture = vi
        .spyOn(PostHog.prototype, "captureException")
        .mockResolvedValue(undefined);
      vi.mocked(getGatewayModel).mockReturnValue(
        Effect.succeed(
          new MockLanguageModelV4({
            doStream: ninaStream([
              {
                type: "error",
                error: new GatewayRateLimitError({
                  message: "private provider response",
                  cause: { key: "private-secret" },
                  generationId: "gen_123-abc",
                }),
              },
            ]),
          })
        )
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
        operation: "provider-busy",
        gateway_error_type: "rate_limit_exceeded",
        gateway_status_code: 429,
        gateway_retryable: true,
        gateway_generation_id: "gen_123-abc",
      });
      expect(report?.error).toMatchObject({
        name: "OperationalError(nina-response.provider-busy)",
        message: "Operational exception",
      });
      expect(JSON.stringify(report)).not.toContain("private");
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
      vi.mocked(getGatewayModel).mockReturnValue(Effect.die("private defect"));
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
