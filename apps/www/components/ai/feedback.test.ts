import { afterEach, describe, expect, it } from "@effect/vitest";
import { captureException } from "@repo/analytics/posthog/browser";
import { NINA_DOCUMENT_MEBIBYTES } from "@repo/backend/client/nina/uploads";
import { NinaCreditError } from "@repo/backend/confect/nina/credits/schema";
import de from "@repo/internationalization/dictionaries/de.json";
import en from "@repo/internationalization/dictionaries/en.json";
import id from "@repo/internationalization/dictionaries/id.json";
import { Effect, Record as Rec } from "effect";
import { createTranslator } from "next-intl";
import { toast } from "sonner";
import {
  NinaConnectionError,
  ninaFailureFeedback,
  ninaFailureLimits,
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
          position: "top-center",
        });
        expect(captureException).not.toHaveBeenCalled();
      })
    );
  }

  it.effect("shows a call refused offline without recording an exception", () =>
    Effect.gen(function* () {
      yield* reportNinaFailure(
        new NinaConnectionError({
          code: "NINA_OFFLINE",
          message: "Convex is offline, so the request was not started.",
        }),
        copy.fallbackMessage
      );

      expect(toast.error).toHaveBeenCalledExactlyOnceWith(
        copy.fallbackMessage,
        { position: "top-center" }
      );
      expect(captureException).not.toHaveBeenCalled();
    })
  );

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
          position: "top-center",
        }
      );
    })
  );
});

describe("the sentences of the failure table", () => {
  for (const [locale, messages] of [
    ["en", en],
    ["de", de],
    ["id", id],
  ] as const) {
    it(`say the limits the code checks, in ${locale}`, () => {
      const onError = vi.fn();
      const t = createTranslator({
        locale,
        messages,
        namespace: "Ai",
        onError,
      });

      for (const { message } of Rec.values(ninaFailureFeedback)) {
        // A sentence that needs a number nobody passed fails to format.
        t(`failures.${message}`, ninaFailureLimits);
      }

      expect(onError).not.toHaveBeenCalled();
      expect(t("failures.attachment-size", ninaFailureLimits)).toContain(
        String(NINA_DOCUMENT_MEBIBYTES)
      );
    });
  }
});
