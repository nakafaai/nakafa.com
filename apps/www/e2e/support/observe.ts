import { expect, type Page } from "@playwright/test";
import { Effect, MutableList } from "effect";

/**
 * Keeps the text that each page event reports to `record` while `use` runs.
 * `use` gets an Effect that reads the texts recorded so far, so a read after
 * the page work sees the events that arrived during it. `attach` listens to
 * the page and returns its detach function, so the listener ends however `use`
 * ends. Playwright types each event on its own, so the caller attaches the
 * listener for the event it observes.
 */
export const withObservedEvents = Effect.fn("NakafaE2E.withObservedEvents")(
  function* <A, E, R>(
    attach: (record: (text: string) => void) => () => void,
    use: (texts: Effect.Effect<readonly string[]>) => Effect.Effect<A, E, R>
  ) {
    return yield* Effect.acquireUseRelease(
      Effect.sync(() => {
        const texts = MutableList.make<string>();
        const detach = attach((text) => MutableList.append(texts, text));
        return { detach, texts };
      }),
      ({ texts }) => use(Effect.sync(() => MutableList.toArray(texts))),
      ({ detach }) => Effect.sync(detach)
    );
  }
);

/** Observes uncaught browser errors for the complete page use program. */
export const withObservedPageErrors = Effect.fn(
  "NakafaE2E.withObservedPageErrors"
)(function* <A, E, R>(
  page: Page,
  use: Effect.Effect<A, E, R>
): Effect.fn.Return<A, E, R> {
  return yield* withObservedEvents(
    (record) => {
      const listener = (error: Error) => record(String(error));
      page.on("pageerror", listener);
      return () => page.off("pageerror", listener);
    },
    (errors) =>
      use.pipe(
        Effect.tap(() => Effect.map(errors, (seen) => expect(seen).toEqual([])))
      )
  );
});
