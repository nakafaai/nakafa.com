import { describe, expect, it } from "@effect/vitest";
import { Effect, Logger, MutableList } from "effect";
import { IntlError, IntlErrorCode } from "use-intl";
import { MessageFailure, reportMessage } from "@/lib/i18n/failure";

/** What use-intl reports for a key no loaded dictionary holds. */
const missing = new IntlError(
  IntlErrorCode.MISSING_MESSAGE,
  "Could not resolve `Editor.numbers` in messages for locale `en`."
);

describe("reportMessage", () => {
  it.effect(
    "fails with the message's code where a missing message must stop the render",
    () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(reportMessage(true, missing));
        expect(failure).toBeInstanceOf(MessageFailure);
        expect(failure.code).toBe(IntlErrorCode.MISSING_MESSAGE);
        expect(failure.message).toContain("Editor.numbers");
      })
  );

  it.effect("logs the failure and lets production render on", () => {
    const messages = MutableList.make<unknown>();
    return Effect.gen(function* () {
      yield* reportMessage(false, missing).pipe(
        Effect.provide(
          Logger.layer([
            Logger.make(({ message }) => {
              MutableList.append(messages, message);
            }),
          ])
        )
      );

      expect(MutableList.toArray(messages)).toStrictEqual([
        [expect.objectContaining({ code: IntlErrorCode.MISSING_MESSAGE })],
      ]);
    });
  });
});
