import { expect, test } from "@playwright/test";
import { ANALYTICS_CONSENT_ROOT_ATTRIBUTE } from "@repo/analytics/consent";
import { Effect, Schema } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";

/** What the page saw when the usage-data mark landed on its root. */
const MarkMoment = Schema.Struct({
  bodyExisted: Schema.Boolean,
  marked: Schema.Boolean,
});

/**
 * Records whether the document's body existed when the usage-data mark was
 * written on its root. Set while the body parses, the mark would restyle every
 * element already drawn.
 */
function watchMark(attribute: string) {
  const moment = { bodyExisted: false, marked: false };
  Object.assign(window, { nakafaMark: moment });
  // The document, not its root: an init script can run before the root exists.
  new MutationObserver((records, observer) => {
    if (records.some((record) => record.target === document.documentElement)) {
      moment.marked = true;
      moment.bodyExisted = document.body !== null;
      observer.disconnect();
    }
  }).observe(document, {
    attributeFilter: [attribute],
    attributes: true,
    subtree: true,
  });
}

/**
 * A visitor who has chosen already gets the usage-data mark with the theme and
 * the other pre-paint marks, in the head, so the root of the drawn page never
 * changes.
 */
test("a returning visitor's usage-data mark lands on the root before the body parses", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* Effect.promise(() =>
          page.addInitScript(watchMark, ANALYTICS_CONSENT_ROOT_ATTRIBUTE)
        );
        yield* Effect.promise(() => page.goto("/id"));
        const moment = yield* Effect.promise(() =>
          page.evaluate(() => Reflect.get(window, "nakafaMark"))
        ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(MarkMoment)));
        yield* Effect.sync(() => {
          expect(moment.marked).toBe(true);
          expect(moment.bodyExisted).toBe(false);
        });
      })
    )
  );
});
