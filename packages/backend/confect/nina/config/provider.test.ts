import { expect, it } from "@effect/vitest";
import { ModelIdSchema } from "@repo/backend/confect/nina/config/model";
import { getGatewayModel } from "@repo/backend/confect/nina/config/provider";
import { ConfigProvider, Effect, Result } from "effect";

it.effect(
  "resolves Vercel Gateway configuration only when a model is requested",
  () =>
    Effect.gen(function* () {
      for (const apiKey of [undefined, "   ", "private-test-key"]) {
        const result = yield* getGatewayModel(
          ModelIdSchema.make("nakafa-lite")
        ).pipe(
          Effect.provide(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown({ AI_GATEWAY_API_KEY: apiKey })
            )
          ),
          Effect.result
        );
        if (apiKey?.trim()) {
          expect(Result.isSuccess(result) && result.success.modelId).toBe(
            "google/gemini-3.5-flash-lite"
          );
        } else {
          expect(Result.isFailure(result) && result.failure._tag).toBe(
            "GatewayConfigurationError"
          );
          expect(String(result)).not.toContain("private-test-key");
        }
      }
    })
);
