import { afterEach, describe, expect, it } from "@effect/vitest";
import { captureException } from "@repo/analytics/posthog/browser";
import { NinaCreditError } from "@repo/backend/confect/nina/credits/schema";
import { Effect } from "effect";
import { toast } from "sonner";
import {
  NinaConnectionError,
  reportNinaFailure,
} from "@/components/ai/feedback";

vi.mock("@repo/analytics/posthog/browser", () => ({
  captureException: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

afterEach(() => vi.clearAllMocks());

const copy = {
  fallbackMessage: "Something went wrong.",
  insufficientCreditsMessage: "You need more credits.",
  rateLimitMessage: "Please wait before trying again.",
};

describe("chat runtime feedback", () => {
  for (const [code, message] of [
    ["INSUFFICIENT_CREDITS", copy.insufficientCreditsMessage],
    ["RATE_LIMITED", copy.rateLimitMessage],
  ] as const) {
    it.effect(`shows ${code} without recording an operational exception`, () =>
      Effect.gen(function* () {
        yield* reportNinaFailure(
          new NinaCreditError({
            code,
            message: "The request could not be admitted.",
          }),
          message
        );

        expect(toast.error).toHaveBeenCalledExactlyOnceWith(message, {
          position: "bottom-center",
        });
        expect(captureException).not.toHaveBeenCalled();
      })
    );
  }

  it.effect("reports an unexpected failure with generic user copy", () =>
    Effect.gen(function* () {
      const error = new NinaConnectionError({
        code: "NINA_CONNECTION_FAILED",
        message: "Private transport diagnostic",
      });
      yield* reportNinaFailure(error, copy.fallbackMessage);

      expect(captureException).toHaveBeenCalledExactlyOnceWith(error, {
        source: "nina-admission",
      });
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(
        copy.fallbackMessage,
        {
          position: "bottom-center",
        }
      );
    })
  );
});
