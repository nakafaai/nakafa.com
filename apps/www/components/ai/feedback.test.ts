import { afterEach, describe, expect, it } from "@effect/vitest";
import { captureException } from "@repo/analytics/posthog/browser";
import { NINA_PROMPT_LENGTH } from "@repo/backend/client/nina/prompt";
import { NINA_DOCUMENT_MEBIBYTES } from "@repo/backend/client/nina/uploads";
import { NinaCreditError } from "@repo/backend/confect/nina/credits/schema";
import de from "@repo/internationalization/dictionaries/de.json";
import en from "@repo/internationalization/dictionaries/en.json";
import id from "@repo/internationalization/dictionaries/id.json";
import { Array as Arr, Effect, Record as Rec } from "effect";
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
          id: expect.any(String),
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
        { id: expect.any(String), position: "top-center" }
      );
      expect(captureException).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "shows a sentence in one notice however often it is said, and another sentence in its own",
    () =>
      Effect.gen(function* () {
        const lost = new NinaConnectionError({
          code: "NINA_CONNECTION_FAILED",
          message: "Private transport diagnostic",
        });
        const offline = new NinaConnectionError({
          code: "NINA_OFFLINE",
          message: "Convex is offline, so the request was not started.",
        });
        const credits = new NinaCreditError({
          code: "INSUFFICIENT_CREDITS",
          message: "The request could not be admitted.",
        });

        yield* reportNinaFailure(lost, copy.fallbackMessage);
        yield* reportNinaFailure(lost, copy.fallbackMessage);
        // A lost connection and an offline call say the same sentence.
        yield* reportNinaFailure(offline, copy.fallbackMessage);
        yield* reportNinaFailure(credits, copy.insufficientCreditsMessage);

        const [first, again, other, apart] = Arr.map(
          vi.mocked(toast.error).mock.calls,
          ([, options]) => options?.id
        );
        // A notice without an id is a new notice each time, so the id must be set.
        expect(first).toBeTypeOf("string");
        expect(again).toBe(first);
        expect(other).toBe(first);
        expect(apart).toBeTypeOf("string");
        expect(apart).not.toBe(first);
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
          id: expect.any(String),
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
      // A number reads the way its language writes it: 100,000 or 100.000.
      expect(t("failures.prompt-length", ninaFailureLimits)).toContain(
        new Intl.NumberFormat(locale).format(NINA_PROMPT_LENGTH)
      );
    });
  }
});
