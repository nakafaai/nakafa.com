import { expect, type Frame, type Page, type Request } from "@playwright/test";
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

/**
 * WebKit's words for a request the page left behind as it moved on: it reports each one as an uncaught
 * error, where Chromium and Firefox drop it in silence. It fails nothing a reader sees.
 */
export const LEFT_BEHIND = /due to access control checks/u;

/**
 * Observes uncaught browser errors for the complete page use program. A request a navigation left
 * behind is no error of the page (`LEFT_BEHIND`), and neither is what the page reports while it is
 * being left: from the moment the main frame requests another document until that document commits,
 * Firefox and WebKit fail the page's loads still in flight, and a scene's canvas reports such a load
 * as an uncaught error (React Three Fiber's `reportError`), where Chromium drops it in silence. The
 * page is gone the moment after, so a reader sees none of it.
 */
export const withObservedPageErrors = Effect.fn(
  "NakafaE2E.withObservedPageErrors"
)(function* <A, E, R>(
  page: Page,
  use: Effect.Effect<A, E, R>
): Effect.fn.Return<A, E, R> {
  return yield* withObservedEvents(
    (record) => {
      let leaving = false;
      const isDocument = (request: Request) =>
        request.isNavigationRequest() && request.frame() === page.mainFrame();
      const leave = (request: Request) => {
        leaving ||= isDocument(request);
      };
      const stay = (request: Request) => {
        leaving &&= !isDocument(request);
      };
      const arrive = (frame: Frame) => {
        leaving &&= frame !== page.mainFrame();
      };
      const listener = (error: Error) => {
        if (!(leaving || LEFT_BEHIND.test(error.message))) {
          record(String(error));
        }
      };
      page.on("request", leave);
      page.on("requestfailed", stay);
      page.on("framenavigated", arrive);
      page.on("pageerror", listener);
      return () => {
        page.off("request", leave);
        page.off("requestfailed", stay);
        page.off("framenavigated", arrive);
        page.off("pageerror", listener);
      };
    },
    (errors) =>
      use.pipe(
        Effect.tap(() => Effect.map(errors, (seen) => expect(seen).toEqual([])))
      )
  );
});
