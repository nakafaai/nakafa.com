import { expect, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";

const SESSION_READ = "/api/auth/get-session";
const CURRICULA_PATH = "/en/curricula";
const ANY_TEXT = /./;

/**
 * A visitor's curricula open no WebSocket and send no session read. The curriculum
 * menu navigates for a visitor, and saves nothing.
 */
test("a visitor's curricula open no socket and send no session read, and a curriculum link opens its page", async ({
  page,
}) => {
  const sockets = MutableList.make<string>();
  const sessionReads = MutableList.make<string>();
  page.on("websocket", (socket) => {
    MutableList.append(sockets, socket.url());
  });
  page.on("request", (request) => {
    if (request.url().includes(SESSION_READ)) {
      MutableList.append(sessionReads, request.url());
    }
  });

  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          page.goto(CURRICULA_PATH, { waitUntil: "load" })
        );
        const first = page
          .getByRole("link")
          .filter({ hasText: ANY_TEXT })
          .nth(1);
        yield* Effect.promise(() => first.click());
        yield* Effect.promise(() =>
          expect(page).not.toHaveURL(new RegExp(`${CURRICULA_PATH}$`))
        );
        yield* Effect.sync(() => {
          expect(MutableList.toArray(sockets)).toStrictEqual([]);
          expect(MutableList.toArray(sessionReads)).toStrictEqual([]);
        });
      })
    )
  );
});
