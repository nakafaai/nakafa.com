import { expect, test } from "@playwright/test";
import { Effect, Schema } from "effect";
import { HERO_NINA_ID } from "@/components/marketing/about/hero/id";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** When the page fired its load event, and when Nina first moved, in milliseconds since the page began. */
const Moments = Schema.Struct({
  firstMove: Schema.Finite,
  loaded: Schema.Finite,
});

/**
 * Records when the page fires its load event and when Nina in the hero first
 * moves, which her life does by writing her picture's attributes.
 */
function watchNina(heroNinaId: string) {
  const moments = { firstMove: -1, loaded: -1 };
  Object.assign(window, { nakafaNinaMoments: moments });
  window.addEventListener("load", () => {
    moments.loaded = performance.now();
  });
  new MutationObserver((records, observer) => {
    const moved = records.some(
      (record) =>
        record.type === "attributes" &&
        record.target instanceof SVGElement &&
        record.target.closest(`#${heroNinaId}`) !== null
    );
    if (moved) {
      moments.firstMove = performance.now();
      observer.disconnect();
    }
  }).observe(document, { attributes: true, subtree: true });
}

/**
 * Nina's life on the home page waits for the page to load and settle, so her
 * frames never compete with the page's own loading. She still comes alive
 * without any scroll or pointer.
 */
test("Nina in the home hero starts moving only after the page has loaded", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* Effect.promise(() =>
          page.addInitScript(watchNina, HERO_NINA_ID)
        );
        yield* Effect.promise(() => page.goto("/en"));
        yield* Effect.promise(() =>
          expect
            .poll(
              () =>
                page.evaluate(
                  () => Reflect.get(window, "nakafaNinaMoments").firstMove
                ),
              { timeout: readinessTimeoutMilliseconds }
            )
            .toBeGreaterThan(0)
        );
        const moments = yield* Effect.promise(() =>
          page.evaluate(() => Reflect.get(window, "nakafaNinaMoments"))
        ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Moments)));
        yield* Effect.sync(() => {
          expect(moments.loaded).toBeGreaterThan(0);
          expect(moments.firstMove).toBeGreaterThan(moments.loaded);
        });
      })
    )
  );
});
