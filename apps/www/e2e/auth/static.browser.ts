import { expect, type Locator, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, MutableList } from "effect";
import { recordServerFunctionCalls } from "@/e2e/support/requests";

const HOME = "/en";
const SIGN_IN = "/en/auth";
/** The longest a press may take to show the sign-in title, in milliseconds. */
const PRESS_TO_TITLE_BUDGET = 200;
/** The cookie that tells a page, before any script runs, that a session may exist. */
const SIGNED_IN_HINT = "nakafa-signed-in";
/** Addresses that only the Worker answers: the auth API, the search screen and the chat. */
const WORKER_PATHS = ["/api/auth/get-session", "/en/search", "/en/chat"];
/** What React writes to the console when the server's HTML and the first render differ. */
const HYDRATION_ERROR = /hydrat|#418|#423|did not match/i;

/**
 * Waits until React has hydrated a link, so a press runs the router. A press
 * before hydration is the browser's own document load.
 */
function hydrated(link: Locator) {
  return expect
    .poll(() =>
      link.evaluate((node) =>
        Object.keys(node).some((key) => key.startsWith("__reactProps$"))
      )
    )
    .toBe(true);
}

/**
 * The sign-in page is prerendered, and the build keeps the answer of each of its
 * loaders as a static file. A visitor's press on the header's Try Nakafa stays in
 * the document and reads only those answers, preloaded when the pointer reaches
 * the link, so the page shows at once and no request reaches a server function.
 */
test("a visitor's press on Try Nakafa shows the sign-in page from static answers", async ({
  page,
}) => {
  const serverFunctionCalls = recordServerFunctionCalls(page);
  const staticAnswerRequests = MutableList.make<string>();
  page.on("request", (request) => {
    if (request.url().includes("/_data/")) {
      MutableList.append(staticAnswerRequests, request.url());
    }
  });

  await page.goto(HOME);
  const tryNakafa = page.locator(`header a[href="${SIGN_IN}"]`).first();
  await expect(tryNakafa).toBeVisible();
  await hydrated(tryNakafa);
  // A document load starts a new document, which drops this mark. A client
  // navigation keeps the document, and so keeps the mark.
  await page.evaluate(() => Reflect.set(document, "nakafaDocumentMark", true));
  await tryNakafa.hover();
  await page.waitForLoadState("networkidle");

  const pressedAt = await page.evaluate(() => performance.now());
  await tryNakafa.click();
  await expect(
    page.getByRole("heading", { name: app.Auth["sign-in-title"] })
  ).toBeVisible();
  const shownAt = await page.evaluate(() => performance.now());

  await expect(page).toHaveURL(new RegExp(`${SIGN_IN}$`));
  expect(
    await page.evaluate(() => Reflect.get(document, "nakafaDocumentMark"))
  ).toBe(true);
  expect(MutableList.toArray(serverFunctionCalls)).toEqual([]);
  expect(MutableList.toArray(staticAnswerRequests).length).toBeGreaterThan(0);
  expect(shownAt - pressedAt).toBeLessThan(PRESS_TO_TITLE_BUDGET);
});

/**
 * A visitor who opens the sign-in address gets the prerendered page from the
 * static assets, which carry an entity tag, and no Worker render, which carries
 * none. The intent in the query string changes nothing about the page.
 */
test("opening the sign-in address answers a visitor with the prerendered page", async ({
  page,
}) => {
  const response = await page.request.get(
    `${SIGN_IN}?${new URLSearchParams({ redirect: "/en/pricing" })}`,
    { maxRedirects: 0 }
  );

  expect(response.status()).toBe(200);
  expect(response.headers().etag).toBeTruthy();
  expect(await response.text()).toContain(app.Auth["sign-in-title"]);
});

/**
 * The static sign-in page takes no address from the Worker: every path that no
 * asset holds still reaches it, so the auth API, the search screen and the chat
 * answer as before, and none of them answers the static not-found page.
 */
test("every address that no asset holds still reaches the Worker", async ({
  page,
}) => {
  for (const path of WORKER_PATHS) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBeLessThan(400);
  }
});

/**
 * A hint that outlived its session hides the sign-in body before the first
 * paint, as it does for a signed-in visitor. Better Auth's answer that there is
 * no session clears the hint cookie, and the page then shows its sign-in button.
 */
test("a visitor whose hint outlived the session gets the sign-in button once the session is read", async ({
  baseURL,
  context,
  page,
}) => {
  await context.addCookies([
    { name: SIGNED_IN_HINT, sameSite: "Lax", url: String(baseURL), value: "1" },
  ]);
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const slot = document.querySelector('[data-account="visitor"]');
      Reflect.set(
        window,
        "nakafaFirstSlotDisplay",
        slot === null ? "absent" : getComputedStyle(slot).display
      );
    });
  });

  await page.goto(SIGN_IN);

  expect(
    await page.evaluate(() => Reflect.get(window, "nakafaFirstSlotDisplay"))
  ).toBe("none");
  await expect(
    page.getByRole("button", { name: app.Auth["continue-with-google"] })
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-signed-in", "no");
  const hints = Arr.filter(
    await context.cookies(),
    (cookie) => cookie.name === SIGNED_IN_HINT && cookie.value === "1"
  );
  expect(hints).toEqual([]);
});

/**
 * The page is prerendered without a query, so the provider's failure that the
 * query carries shows once the page has hydrated, and the server's HTML and the
 * first render agree.
 */
test("a provider failure in the address shows on the static page without a hydration error", async ({
  page,
}) => {
  const errors = MutableList.make<string>();
  page.on("console", (message) => {
    if (message.type() === "error") {
      MutableList.append(errors, message.text());
    }
  });
  page.on("pageerror", (error) => MutableList.append(errors, String(error)));

  await page.goto(`${SIGN_IN}?${new URLSearchParams({ error: "oauth" })}`);

  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: app.Toast["provider-error"].title })
  ).toBeVisible();
  expect(
    Arr.filter(MutableList.toArray(errors), (text) =>
      HYDRATION_ERROR.test(text)
    )
  ).toEqual([]);
});
