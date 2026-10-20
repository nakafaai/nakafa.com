import { expect, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";

/**
 * A visitor without the signed-in hint cookie loads the home page with no
 * WebSocket and no session read: the page creates no Convex client and no Better
 * Auth client, so the live session waits for a signed-in account. The composer
 * is on the page and the page throws no error, because the visitor's composer
 * reads no identity or Convex hook.
 */
test("an anonymous home load shows Nina's composer, opens no WebSocket, reads no session and throws no error", async ({
  page,
}) => {
  const sockets = MutableList.make<string>();
  const sessionReads = MutableList.make<string>();
  page.on("websocket", (socket) => {
    MutableList.append(sockets, socket.url());
  });
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/get-session")) {
      MutableList.append(sessionReads, request.url());
    }
  });

  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* Effect.promise(() => page.goto("/en", { waitUntil: "load" }));
        yield* Effect.promise(() =>
          expect(page.locator("[data-marketing-page]")).toBeVisible()
        );
        yield* Effect.promise(() =>
          expect(
            page.locator("#hero").getByRole("heading", { level: 1 })
          ).toBeVisible()
        );
        yield* Effect.promise(() =>
          expect(
            page.getByRole("textbox", { name: "Ask Nina anything..." })
          ).toBeVisible()
        );

        yield* Effect.sync(() =>
          expect(MutableList.toArray(sockets)).toStrictEqual([])
        );
        yield* Effect.sync(() =>
          expect(MutableList.toArray(sessionReads)).toStrictEqual([])
        );
      })
    )
  );
});
