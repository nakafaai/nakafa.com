import { expect, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { withReader } from "@/e2e/support/reader";
import {
  linkOn,
  notAvailable,
  offersNoWriting,
  ownedChat,
  readLink,
  readsChat,
  shareChat,
} from "@/e2e/support/share";

const PROMPT = "Why is the derivative of sine the cosine?";
const TITLE = "The derivative of sine";
const SESSION_READ = "/api/auth/get-session";
const SIGN_IN = /\/en\/auth/;
const NEW_CHAT = "New chat";
const TRAILING_A = /A$/u;
const TRAILING_CHARACTER = /.$/u;

/**
 * A reader with no session opens a shared link: the whole chat shows, with no
 * control to write and no socket. Its one action asks the reader to sign in, and
 * the page sends no session read before that.
 */
test.describe("A reader's shared chat at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 300_000 });

  test("a shared link shows the whole chat read-only, with no socket, and its one action signs in", async ({
    baseURL,
    browser,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const owner = yield* ownedChat(page, origin, {
          prompt: PROMPT,
          title: TITLE,
        });
        const link = yield* Effect.promise(() =>
          shareChat(page, owner.changes)
        );

        yield* withReader(browser, origin, (reader) =>
          Effect.gen(function* () {
            const sockets = MutableList.make<string>();
            const sessionReads = MutableList.make<string>();
            reader.on("websocket", (socket) => {
              MutableList.append(sockets, socket.url());
            });
            reader.on("request", (request) => {
              if (request.url().includes(SESSION_READ)) {
                MutableList.append(sessionReads, request.url());
              }
            });

            yield* Effect.promise(async () => {
              await reader.goto(linkOn(origin, link));
              await readsChat(reader, TITLE, PROMPT);
              await offersNoWriting(reader);
            });
            yield* Effect.promise(async () => {
              await reader
                .getByRole("button", { exact: true, name: NEW_CHAT })
                .click();
              await expect(reader).toHaveURL(SIGN_IN);
            });
            yield* Effect.sync(() => {
              expect(MutableList.toArray(sockets)).toStrictEqual([]);
              expect(MutableList.toArray(sessionReads)).toStrictEqual([]);
            });
          })
        );
      })
    );
  });

  test("an address that opens no chat shows the chat as not available", async ({
    baseURL,
    browser,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const owner = yield* ownedChat(page, origin, {
          prompt: PROMPT,
          title: TITLE,
        });
        const link = yield* Effect.promise(() =>
          shareChat(page, owner.changes)
        );
        const { path, token } = readLink(link);
        const other = token.endsWith("A")
          ? token.replace(TRAILING_A, "B")
          : token.replace(TRAILING_CHARACTER, "A");

        yield* withReader(browser, origin, (reader) =>
          Effect.promise(async () => {
            await reader.goto(`${origin}${path}#share=${other}`);
            await expect(notAvailable(reader)).toBeVisible();
            await expect(
              reader.locator('[data-slot="bubble"]').filter({ hasText: PROMPT })
            ).toHaveCount(0);

            await reader.goto(`${origin}${path}`);
            await expect(notAvailable(reader)).toBeVisible();
            await expect(
              reader.locator('[data-slot="bubble"]').filter({ hasText: PROMPT })
            ).toHaveCount(0);
          })
        );
      })
    );
  });
});
