import { expect, type Page, test } from "@playwright/test";
import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import { Array as Arr, Effect, MutableList } from "effect";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { SERVER_FUNCTION_PATH } from "@/e2e/support/requests";

const SESSION_READ = "/api/auth/get-session";
const AUTH_URL = /\/auth/;

/**
 * A visitor's profile opens no WebSocket and sends no session read. Its first
 * posts and comments come from the loader, and each further page reads through
 * the server function. A like asks the visitor to sign in.
 */
test("a visitor's profile opens no socket, sends no session read, loads more posts through the server, and asks for sign-in to like", async ({
  baseURL,
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

  await runOnPage(page, baseURL, (origin) =>
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const { learner } = yield* openChatPage(page, origin);
        // One post more than the loader's first page, so the scroll has a page to read.
        yield* Effect.forEach(
          Arr.range(1, POST_PAGE_SIZE + 1),
          (index) => learner.writePost(`Post ${index}`),
          { discard: true }
        );
        yield* Effect.promise(() => page.context().clearCookies());
        yield* Effect.promise(() =>
          page.goto(`/en/@${learner.username}`, { waitUntil: "load" })
        );
        yield* Effect.promise(() =>
          expect(page.locator('[data-slot="feed-row"]').first()).toBeVisible()
        );
        // The loader's first page is on the screen, so the scroll must add a page read.
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
        yield* Effect.promise(() => likeFirstRow(page));
        yield* Effect.promise(() => expect(page).toHaveURL(AUTH_URL));
        yield* Effect.sync(() => {
          expect(MutableList.toArray(sockets)).toStrictEqual([]);
          expect(MutableList.toArray(sessionReads)).toStrictEqual([]);
        });
      })
    )
  );
});

/** Scrolls the posts to their end, where the intersection trigger loads the next page. */
async function scrollRows(page: Page) {
  await page.mouse.wheel(0, 4000);
}

/** Presses the like control of the first post, which sends a visitor to sign in. */
async function likeFirstRow(page: Page) {
  await page
    .locator('[data-slot="feed-row"]')
    .first()
    .getByRole("button")
    .first()
    .click();
}
