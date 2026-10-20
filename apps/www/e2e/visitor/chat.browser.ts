import { expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect, MutableList } from "effect";
import { CHAT_PATH } from "@/e2e/support/chat";
import { withObservedPageErrors } from "@/e2e/support/observe";

const SESSION_READ = "/api/auth/get-session";
const AUTH_URL = /\/auth/;

/**
 * A visitor's new chat opens no WebSocket and sends no session read. Its composer
 * is the visitor's, so sending a message sends the visitor to sign in.
 */
test("a visitor's new chat opens no socket, and sending from its composer asks for sign-in", async ({
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
          page.goto(CHAT_PATH, { waitUntil: "load" })
        );
        const composer = page.getByLabel(app.Ai["text-placeholder"]).first();
        yield* Effect.promise(() => expect(composer).toBeVisible());
        yield* Effect.promise(() =>
          composer.fill("Explain the quadratic formula")
        );
        yield* Effect.promise(() => composer.press("Enter"));
        yield* Effect.promise(() => expect(page).toHaveURL(AUTH_URL));
        yield* Effect.sync(() => {
          expect(MutableList.toArray(sockets)).toStrictEqual([]);
          expect(MutableList.toArray(sessionReads)).toStrictEqual([]);
        });
      })
    )
  );
});
