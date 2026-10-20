import { afterEach, describe, expect, it } from "@effect/vitest";
import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { captureException } from "@repo/analytics/posthog/capture";
import { NINA_PROMPT_LENGTH } from "@repo/backend/client/nina/prompt";
import { NINA_DOCUMENT_MEBIBYTES } from "@repo/backend/client/nina/uploads";
import { NinaCreditError } from "@repo/backend/confect/nina/credits/schema";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect, Fiber, Option, Record as Rec } from "effect";
import { TestClock } from "effect/testing";
import {
  NinaConnectionError,
  ninaFailureFeedback,
  ninaFailureLimits,
  promptRefusal,
  reportNinaFailure,
  requireNinaConnection,
} from "@/components/ai/feedback";
import { NO_BREAK, toastTranslator } from "@/test/ai";

vi.mock("@repo/analytics/posthog/capture", () => ({
  captureException: vi.fn(),
}));
vi.mock("@repo/design-system/lib/toast/notify", () => ({
  toast: { error: vi.fn() },
}));

afterEach(() => vi.clearAllMocks());

const fallbackMessage: ToastCopy = {
  description: "failure-connection.description",
  title: "failure-connection.title",
};
const creditsMessage: ToastCopy = {
  description: "failure-credits.description",
  title: "failure-credits.title",
};
const rateLimitMessage: ToastCopy = {
  description: "failure-rate-limit.description",
  title: "failure-rate-limit.title",
};

describe("chat runtime feedback", () => {
  it.effect(
    "shows insufficient credits without recording an operational exception",
    () =>
      Effect.gen(function* () {
        yield* reportNinaFailure(
          new NinaCreditError({
            code: "INSUFFICIENT_CREDITS",
            message: "The request could not be admitted.",
          }),
          creditsMessage
        );

        expect(toast.error).toHaveBeenCalledExactlyOnceWith(creditsMessage, {
          id: expect.any(String),
          position: "top-center",
        });
        expect(captureException).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "shows a rate limit without recording an operational exception",
    () =>
      Effect.gen(function* () {
        yield* reportNinaFailure(
          new NinaCreditError({
            code: "RATE_LIMITED",
            message: "The request could not be admitted.",
          }),
          rateLimitMessage
        );

        expect(toast.error).toHaveBeenCalledExactlyOnceWith(rateLimitMessage, {
          id: expect.any(String),
          position: "top-center",
        });
        expect(captureException).not.toHaveBeenCalled();
      })
  );

  it.effect("shows a call refused offline without recording an exception", () =>
    Effect.gen(function* () {
      yield* reportNinaFailure(
        new NinaConnectionError({
          code: "NINA_OFFLINE",
          message: "Convex is offline, so the request was not started.",
        }),
        fallbackMessage
      );

      expect(toast.error).toHaveBeenCalledExactlyOnceWith(fallbackMessage, {
        id: expect.any(String),
        position: "top-center",
      });
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

        yield* reportNinaFailure(lost, fallbackMessage);
        yield* reportNinaFailure(lost, fallbackMessage);
        // A lost connection and an offline call say the same sentence.
        yield* reportNinaFailure(offline, fallbackMessage);
        yield* reportNinaFailure(credits, creditsMessage);

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
      yield* reportNinaFailure(error, fallbackMessage);

      expect(captureException).toHaveBeenCalledExactlyOnceWith(error, {
        source: "nina-admission",
      });
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(fallbackMessage, {
        id: expect.any(String),
        position: "top-center",
      });
    })
  );
});

describe("the refusal of a prompt over the limit", () => {
  const tooLong = "a".repeat(NINA_PROMPT_LENGTH + 1);

  it("takes a prompt of exactly the limit, counted without the spaces around it", () => {
    const fits = "a".repeat(NINA_PROMPT_LENGTH);

    expect(promptRefusal(fits, false)).toEqual(Option.none());
    expect(promptRefusal(`  ${fits}\n`, false)).toEqual(Option.none());
  });

  it("takes a press with no text, which sends nothing", () => {
    expect(promptRefusal(undefined, false)).toEqual(Option.none());
  });

  it("refuses a prompt one character over with its own failure", () => {
    expect(Option.getOrNull(promptRefusal(tooLong, false))).toMatchObject({
      _tag: "NinaPromptError",
      code: "NINA_PROMPT_LENGTH",
    });
  });

  it("does not refuse a press while a reply streams, whatever the composer holds", () => {
    expect(promptRefusal(tooLong, true)).toEqual(Option.none());
  });
});

describe("the sentences of the failure table", () => {
  it.effect.each(APP_LOCALE_CODES)(
    "say the limits the code checks, in %s",
    (locale) =>
      Effect.gen(function* () {
        const onError = vi.fn();
        const t = yield* toastTranslator(locale, onError);

        for (const { message } of Rec.values(ninaFailureFeedback)) {
          // A sentence that needs a number nobody passed fails to format.
          t(`failure-${message}.title`, ninaFailureLimits);
          t(`failure-${message}.description`, ninaFailureLimits);
        }

        expect(onError).not.toHaveBeenCalled();
        expect(
          t("failure-attachment-size.description", ninaFailureLimits)
        ).toContain(String(NINA_DOCUMENT_MEBIBYTES));
      })
  );

  it.effect.each(APP_LOCALE_CODES)(
    "keeps each number with its unit or its noun on one line, in %s",
    (locale) =>
      Effect.gen(function* () {
        const t = yield* toastTranslator(locale);
        const size = new Intl.NumberFormat(locale).format(
          NINA_DOCUMENT_MEBIBYTES
        );
        const sentence = t(
          "failure-attachment-size.description",
          ninaFailureLimits
        );

        // The learner reads "10 MiB" as one word, so a line never ends between
        // the number and its unit.
        expect(sentence).toContain(`${size}${NO_BREAK}`);
        expect(sentence).not.toContain(`${size} `);
      })
  );
});

type Connection = Parameters<typeof requireNinaConnection>[0];
type ConnectionState = ReturnType<Connection["connectionState"]>;

/** A Convex connection whose socket is up or down, as the Convex client reports it. */
function connection(connected: boolean): Connection {
  const state: ConnectionState = {
    connectionCount: 1,
    connectionRetries: 0,
    hasEverConnected: true,
    hasInflightRequests: false,
    inflightActions: 0,
    inflightMutations: 0,
    isWebSocketConnected: connected,
    timeOfOldestInflightRequest: null,
  };
  return {
    connectionState: () => state,
    subscribeToConnectionState: vi.fn(() => () => undefined),
  };
}

describe("the connection a Nina call waits on", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.effect(
    "refuses a call made offline as NINA_OFFLINE, without waiting for a socket",
    () =>
      Effect.gen(function* () {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        const convex = connection(false);

        const failure = yield* Effect.flip(requireNinaConnection(convex));

        expect(failure).toMatchObject({
          _tag: "NinaConnectionError",
          code: "NINA_OFFLINE",
        });
        expect(convex.subscribeToConnectionState).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "refuses as NINA_OFFLINE when no socket connects within five seconds",
    () =>
      Effect.gen(function* () {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
        const fiber = yield* Effect.forkChild(
          Effect.flip(requireNinaConnection(connection(false)))
        );

        yield* TestClock.adjust("5 seconds");
        const failure = yield* Fiber.join(fiber);

        expect(failure).toMatchObject({
          _tag: "NinaConnectionError",
          code: "NINA_OFFLINE",
        });
      })
  );

  it.effect("lets a call start at once while the socket is connected", () =>
    Effect.gen(function* () {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

      yield* requireNinaConnection(connection(true));
    })
  );
});
