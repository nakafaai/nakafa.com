import { expect, test } from "@playwright/test";
import { MutableList } from "effect";

/**
 * A visitor without the signed-in hint cookie loads the home page with no
 * WebSocket and no session read: the page creates no Convex client and no Better
 * Auth client, so the live session waits for a signed-in account.
 */
test("an anonymous home load opens no WebSocket and reads no session", async ({
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

  await page.goto("/en", { waitUntil: "load" });
  await expect(page.locator("[data-marketing-page]")).toBeVisible();

  expect(MutableList.toArray(sockets)).toStrictEqual([]);
  expect(MutableList.toArray(sessionReads)).toStrictEqual([]);
});
