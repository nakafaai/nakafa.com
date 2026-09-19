import { afterEach, describe, expect, it } from "@effect/vitest";
import { captureException } from "@repo/analytics/posthog/browser";
import { Effect } from "effect";
import { toast } from "sonner";
import { reportChatRuntimeError } from "@/components/ai/helpers/runtime-error";

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
  ]) {
    it.effect(`shows ${code} without recording an operational exception`, () =>
      Effect.gen(function* () {
        yield* reportChatRuntimeError({
          ...copy,
          error: new Error(` ${code}\n`),
        });

        expect(toast.error).toHaveBeenCalledExactlyOnceWith(message, {
          position: "bottom-center",
        });
        expect(captureException).not.toHaveBeenCalled();
      })
    );
  }

  it.effect("reports an unexpected failure with generic user copy", () =>
    Effect.gen(function* () {
      const error = new Error("provider connection failed");
      yield* reportChatRuntimeError({ ...copy, error });

      expect(captureException).toHaveBeenCalledExactlyOnceWith(error, {
        source: "chat-provider-send-message",
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
