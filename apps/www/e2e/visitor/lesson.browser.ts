import { expect, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { withObservedPageErrors } from "@/e2e/support/observe";

const SESSION_READ = "/api/auth/get-session";

/**
 * A visitor's lesson load creates no Convex client. The page opens no WebSocket,
 * sends no Better Auth session read, and throws no error. The lesson still shows,
 * with the usage-data prompt through the anonymous browser path, and the sidebar
 * footer is the visitor's guest card.
 */
test("a visitor's lesson load opens no WebSocket, sends no session read and throws no error", async ({
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
          page.goto(LESSON_PATH, { waitUntil: "load" })
        );
        yield* Effect.promise(() =>
          expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
        );
        yield* Effect.promise(() =>
          expect(page.locator("[data-analytics-consent-prompt]")).toBeVisible()
        );
        yield* Effect.promise(() =>
          expect(page.locator('[data-account="visitor"]').first()).toBeVisible()
        );

        yield* Effect.sync(() => {
          expect(MutableList.toArray(sockets)).toStrictEqual([]);
          expect(MutableList.toArray(sessionReads)).toStrictEqual([]);
        });
      })
    )
  );
});
