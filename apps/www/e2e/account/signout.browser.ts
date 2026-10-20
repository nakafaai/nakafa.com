import { type BrowserContextOptions, expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect, MutableList } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { withBrowserContext } from "@/e2e/support/context";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";

/**
 * A window property that marks the learner's document. A full document load
 * replaces the window, so the marker is gone afterwards, while a client navigation
 * keeps it.
 */
const LEARNER_DOCUMENT = "nakafaLearnerDocument";

/**
 * Signing out ends in a full document load of the locale home. The home is a
 * visitor's page, so the document that loads opens no WebSocket, and the socket the
 * learner's lesson held closes with its document. A client-side navigation would
 * keep that window and its socket, so the marker must be gone afterwards.
 */
test("sign-out lands on the locale home in a new document with no socket", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  const origin = baseURL ?? "";
  const options: BrowserContextOptions = {
    baseURL: origin,
    serviceWorkers: "block",
  };

  await Effect.runPromise(
    withBrowserContext(browser, options, (context) =>
      Effect.gen(function* () {
        yield* signInLearner(context, origin);
        const page = yield* Effect.promise(() => context.newPage());
        const sockets = MutableList.make<string>();
        const closedSockets = MutableList.make<string>();
        page.on("websocket", (socket) => {
          MutableList.append(sockets, socket.url());
          socket.on("close", () => {
            MutableList.append(closedSockets, socket.url());
          });
        });
        yield* withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* Effect.promise(() =>
              page.goto(LESSON_PATH, { waitUntil: "load" })
            );
            const member = page.locator('[data-account="member"]').first();
            yield* Effect.promise(() => expect(member).toBeVisible());
            yield* Effect.promise(() =>
              page.evaluate((name) => {
                Object.assign(window, { [name]: true });
              }, LEARNER_DOCUMENT)
            );
            const socketsBeforeSignOut = MutableList.toArray(sockets).length;
            yield* Effect.promise(() =>
              member.getByRole("button").first().click()
            );
            yield* Effect.promise(() =>
              page
                .getByRole("menuitem", { name: app.Auth.logout, exact: true })
                .click()
            );
            yield* Effect.promise(() =>
              page.waitForURL((url) => url.pathname === "/en", {
                waitUntil: "load",
              })
            );
            yield* Effect.promise(() =>
              expect
                .poll(() => MutableList.toArray(closedSockets).length)
                .toBeGreaterThanOrEqual(socketsBeforeSignOut)
            );
            const learnerDocument = yield* Effect.promise(() =>
              page.evaluate(
                (name) => Object.hasOwn(window, name),
                LEARNER_DOCUMENT
              )
            );
            yield* Effect.sync(() => {
              expect(learnerDocument).toBe(false);
              expect(
                Arr.drop(MutableList.toArray(sockets), socketsBeforeSignOut)
              ).toStrictEqual([]);
            });
          })
        );
      })
    )
  );
});
