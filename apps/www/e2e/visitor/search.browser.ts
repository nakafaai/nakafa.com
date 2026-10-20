import { expect, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { SERVER_FUNCTION_PATH } from "@/e2e/support/requests";

const SESSION_READ = "/api/auth/get-session";
const SEARCH_PATH = "/en/search?q=geometry#results";

/**
 * A visitor's search opens no WebSocket and sends no session read. The results of
 * the typed query come from the server function, which every viewer uses.
 */
test("a visitor's search opens no socket, sends no session read, and reads its results through the server function", async ({
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
          page.goto(SEARCH_PATH, { waitUntil: "load" })
        );
        yield* Effect.promise(() =>
          expect
            .poll(() => MutableList.toArray(serverCalls).length)
            .toBeGreaterThan(0)
        );
        yield* Effect.sync(() => {
          expect(MutableList.toArray(sockets)).toStrictEqual([]);
          expect(MutableList.toArray(sessionReads)).toStrictEqual([]);
        });
      })
    )
  );
});
