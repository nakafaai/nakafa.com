import { expect, type Page, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { SERVER_FUNCTION_PATH } from "@/e2e/support/requests";

const SESSION_READ = "/api/auth/get-session";
const TRACK_PATH = "/en/try-out/indonesia/snbt/2027";

/**
 * A visitor's try-out track opens no WebSocket and sends no session read. Its
 * first rows come from the loader, and a window it grows reads through the server
 * function, so the only browser request for rows is that server function.
 */
test("a visitor's try-out track opens no socket, sends no session read, and loads more rows through the server function", async ({
  page,
}) => {
  const sockets = MutableList.make<string>();
  const sessionReads = MutableList.make<string>();
  const serverCalls = MutableList.make<string>();
  page.on("websocket", (socket) => {
    MutableList.append(sockets, socket.url());
  });
  page.on("request", (request) => {
    if (request.url().includes(SESSION_READ)) {
      MutableList.append(sessionReads, request.url());
    }
    if (request.url().includes(SERVER_FUNCTION_PATH)) {
      MutableList.append(serverCalls, request.url());
    }
  });

  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          page.goto(TRACK_PATH, { waitUntil: "load" })
        );
        yield* Effect.promise(() =>
          expect(page.getByRole("table").first()).toBeVisible()
        );
        // The loader's own window read is already counted, so the scroll must add one.
        yield* Effect.promise(() => page.waitForLoadState("networkidle"));
        const loadedCalls = yield* Effect.sync(
          () => MutableList.toArray(serverCalls).length
        );
        yield* Effect.promise(() => scrollRows(page));
        yield* Effect.promise(() =>
          expect
            .poll(() => MutableList.toArray(serverCalls).length)
            .toBeGreaterThan(loadedCalls)
        );
        yield* Effect.sync(() => {
          expect(MutableList.toArray(sockets)).toStrictEqual([]);
          expect(MutableList.toArray(sessionReads)).toStrictEqual([]);
        });
      })
    )
  );
});

/** Scrolls the table to its end, where the intersection trigger loads the next window. */
async function scrollRows(page: Page) {
  await page.getByRole("table").first().hover();
  await page.mouse.wheel(0, 4000);
}
