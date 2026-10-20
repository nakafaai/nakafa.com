import { expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect, MutableList } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { withObservedPageErrors } from "@/e2e/support/observe";

const SESSION_READ = "/api/auth/get-session";

/**
 * A visitor's lesson load creates no Convex client. The page opens no WebSocket,
 * sends no Better Auth session read, and throws no error. The lesson still shows,
 * with the usage-data prompt through the anonymous browser path, and the sidebar
 * footer is the visitor's guest card. The first scroll and key press warm Nina's
 * sheet, whose composer renders without a client, so the page still opens no socket
 * and throws no error after the interaction.
 */
test("a visitor's lesson load and first interaction open no WebSocket, send no session read and throw no error", async ({
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

        yield* Effect.promise(() => page.mouse.wheel(0, 400));
        yield* Effect.promise(() => page.keyboard.press("ArrowDown"));
        yield* Effect.promise(() =>
          expect(
            page.getByLabel(app.Ai["text-placeholder"]).first()
          ).toBeAttached()
        );
        yield* Effect.promise(() =>
          expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
        );

        yield* Effect.sync(() => {
          expect(MutableList.toArray(sockets)).toStrictEqual([]);
          expect(MutableList.toArray(sessionReads)).toStrictEqual([]);
        });
      })
    )
  );
});
