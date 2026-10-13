import { expect, type Page, test, type WebSocket } from "@playwright/test";
import { Deferred, Effect, Ref } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import {
  withObservedEvents,
  withObservedPageErrors,
} from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const SETTINGS = "/en/user/settings";
const SESSION_ANSWER = "**/api/auth/get-session**";
/** What Better Auth answers when its session lookup throws, as the trace of a failed run showed. */
const SESSION_REFUSED =
  '{"message":"Failed to get session","code":"FAILED_TO_GET_SESSION"}';
const NAME = "Learner After Reload";
/** How Convex's sync protocol names the server's answer to a mutation. */
const MUTATION_ANSWER = '"type":"MutationResponse"';

/** The name field of the settings page and the button that saves it. */
function nameForm(page: Page) {
  const form = page.locator("#user-settings-name-form");
  return {
    name: form.locator("#user-settings-name"),
    save: form.getByRole("button", { name: "Save" }),
  };
}

/**
 * Writes a name once the form answers to typing. The form is in the server's
 * HTML before React takes it over, and typing into it earlier is lost, so the
 * name is written again until the save button, which only React enables,
 * answers.
 */
const writeName = Effect.fn("NakafaE2E.writeName")(function* (
  page: Page,
  name: string
) {
  const form = nameForm(page);
  yield* Effect.promise(() =>
    expect(async () => {
      await form.name.fill(name);
      await expect(form.save).toBeEnabled({ timeout: 500 });
    }).toPass({ intervals: [50], timeout: readinessTimeoutMilliseconds })
  );
  return form;
});

test("a change made the moment a page loads is sent signed in", async ({
  baseURL,
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const origin = yield* Effect.fromNullishOr(baseURL);
        yield* signInLearner(page.context(), origin);

        // The first load settles the session, which the browser keeps.
        yield* Effect.promise(() => page.goto(SETTINGS));
        yield* Effect.promise(() =>
          page.waitForFunction(
            () => window.localStorage.getItem("nakafa-session") !== null,
            undefined,
            { timeout: readinessTimeoutMilliseconds }
          )
        );

        // On the next load Better Auth's answer for the session is held back,
        // so the page stays in the moment before it knows who is signed in.
        const answered = yield* Deferred.make<void>();
        const run = Effect.runPromiseWith(yield* Effect.context<never>());
        yield* Effect.promise(() =>
          page.route(SESSION_ANSWER, async (route) => {
            await run(Deferred.await(answered));
            await route.continue();
          })
        );

        // The server's answer to the save, read from the socket: the page
        // shows a failed save and a save in flight the same way at first.
        const answers = yield* withObservedEvents(
          (record) => {
            const listen = (socket: WebSocket) => {
              socket.on("framereceived", ({ payload }) => {
                if (
                  typeof payload === "string" &&
                  payload.includes(MUTATION_ANSWER)
                ) {
                  record(payload);
                }
              });
            };
            page.on("websocket", listen);
            return () => page.off("websocket", listen);
          },
          (seen) =>
            Effect.gen(function* () {
              yield* Effect.promise(() => page.reload());
              const form = yield* writeName(page, NAME);
              yield* Effect.promise(() => form.save.click());
              yield* Effect.promise(() =>
                expect
                  .poll(() => run(seen), {
                    timeout: readinessTimeoutMilliseconds,
                  })
                  .not.toEqual([])
              );
              return yield* seen;
            })
        );

        // The save went through signed in while the session was unanswered.
        expect(answers).toHaveLength(1);
        expect(answers[0]).toContain('"success":true');
        const form = nameForm(page);
        yield* Effect.promise(() => expect(form.save).toBeDisabled());
        yield* Effect.promise(() =>
          expect(page.locator("[data-sonner-toast]")).toHaveCount(0)
        );

        // The server kept the name. The held answer goes through, and so
        // does every later one.
        yield* Deferred.succeed(answered, undefined);
        yield* Effect.promise(() => page.reload());
        yield* Effect.promise(() =>
          expect(nameForm(page).name).toHaveValue(NAME, {
            timeout: readinessTimeoutMilliseconds,
          })
        );
      })
    )
  );
});

test("a session read the server refuses once is read again", async ({
  baseURL,
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const origin = yield* Effect.fromNullishOr(baseURL);
        yield* signInLearner(page.context(), origin);

        // The server refuses the first read of the session, as it does when a
        // function of the backend runs past its time limit on a busy machine.
        const reads = yield* Ref.make(0);
        const run = Effect.runPromiseWith(yield* Effect.context<never>());
        yield* Effect.promise(() =>
          page.route(SESSION_ANSWER, async (route) => {
            const read = await run(
              Ref.updateAndGet(reads, (count) => count + 1)
            );
            if (read > 1) {
              await route.continue();
              return;
            }
            await route.fulfill({
              body: SESSION_REFUSED,
              contentType: "application/json",
              status: 500,
            });
          })
        );

        // The browser keeps the id of a session it has settled on, and keeps
        // none after a failed read, so the key shows the page asked again.
        yield* Effect.promise(() => page.goto(SETTINGS));
        yield* Effect.promise(() =>
          page.waitForFunction(
            () => window.localStorage.getItem("nakafa-session") !== null,
            undefined,
            { timeout: readinessTimeoutMilliseconds }
          )
        );
        expect(yield* Ref.get(reads)).toBeGreaterThanOrEqual(2);
      })
    )
  );
});
