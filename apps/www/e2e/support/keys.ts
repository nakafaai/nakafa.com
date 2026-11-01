import { expect, type Page } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect, Record as Rec } from "effect";
import { withObservedEvents } from "@/e2e/support/observe";

/**
 * What use-intl draws for a message it cannot resolve: the message's `Namespace.key`. Every namespace of the
 * dictionaries is named, so a sentence that happens to hold a dot never matches.
 */
const RAW_KEY = new RegExp(
  `\\b(?:${Arr.join(Rec.keys(en), "|")})\\.[a-z][\\w.-]*`,
  "gu"
);

/** Reads the raw keys in what the page shows, its document title included. */
const readRawKeys = (page: Page) =>
  Effect.promise(async () => {
    const text = await page.locator("body").ariaSnapshot();
    return Arr.map(
      Arr.fromIterable(`${await page.title()}\n${text}`.matchAll(RAW_KEY)),
      (match) => match[0]
    );
  });

/**
 * Fails when a message reached the page without its text while `use` ran: a raw `Namespace.key` on the page at the end,
 * or the `MISSING_MESSAGE` error use-intl logs when a render asks for a message no dictionary of the route holds, which
 * also catches the text of a closed menu.
 */
export const withoutRawKeys = Effect.fn("NakafaE2E.withoutRawKeys")(function* <
  A,
  E,
  R,
>(page: Page, label: string, use: Effect.Effect<A, E, R>) {
  return yield* withObservedEvents(
    (record) => {
      const listener = (message: {
        text: () => string;
        type: () => string;
      }) => {
        if (
          message.type() === "error" &&
          message.text().includes("MISSING_MESSAGE")
        ) {
          record(message.text());
        }
      };
      page.on("console", listener);
      return () => page.off("console", listener);
    },
    (missing) =>
      use.pipe(
        Effect.tap(() =>
          Effect.gen(function* () {
            const keys = yield* readRawKeys(page);
            expect(keys, label).toEqual([]);
            expect(yield* missing, label).toEqual([]);
          })
        )
      )
  );
});
