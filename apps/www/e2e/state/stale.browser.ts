import { expect, type Page, test } from "@playwright/test";
import { GOING_ATTRIBUTE } from "@repo/design-system/lib/lazy";
import standalone from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import { HashSet } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { waitUntilTakenOver } from "@/e2e/support/window";

const SIGN_IN = "/en/auth";
/** The sign-in page's title, in English. */
const TITLE = "Sign in to Nakafa";
/** The window mark of the first document, which a reload replaces. */
const FIRST_DOCUMENT = "nakafaFirstDocument";
/** The tab's storage mark set if any document of the test ever drew the error state. */
const BROKE = "nakafa-e2e-drew-error";
/** The tab's reload mark of the sign-in page, as the head script keeps it. */
const SIGN_IN_MARK = `nakafa:stale-chunk:${SIGN_IN}`;

/**
 * Opens the sign-in page once React owns it, and marks the tab's storage if any
 * document of the test ever draws the error state. Answers the theme button,
 * whose menu loads a chunk the first document did not load.
 */
async function openSignIn(page: Page) {
  await page.addInitScript(
    ({ broke, title }) => {
      new MutationObserver(() => {
        if (document.body?.innerText.includes(title)) {
          sessionStorage.setItem(broke, "1");
        }
      }).observe(document, { childList: true, subtree: true });
    },
    { broke: BROKE, title: standalone.Error.title }
  );
  await page.goto(SIGN_IN);
  const theme = page.getByRole("button", { exact: true, name: "Theme" });
  await waitUntilTakenOver(theme);
  return theme;
}

/**
 * Deploys under the open page: every chunk that the first document did not load
 * answers 404 until the page loads again, as the chunks of an earlier deploy do
 * once the next deploy is live. Answers a wait for that next load.
 */
async function deployUnder(page: Page) {
  const loaded = HashSet.fromIterable(
    await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name)
    )
  );
  const removed = { active: true };
  await page.route("**/assets/*.js", (route) => {
    if (removed.active && !HashSet.has(loaded, route.request().url())) {
      return route.fulfill({ body: "Not found", status: 404 });
    }
    return route.continue();
  });
  await page.evaluate(
    (mark) => Reflect.set(window, mark, true),
    FIRST_DOCUMENT
  );
  page.once("load", () => {
    removed.active = false;
  });
}

/** Proves that the page loaded again into the current deploy and never drew the error state. */
async function expectReloadedWithoutError(page: Page) {
  await expect
    .poll(() =>
      page
        .evaluate((mark) => Reflect.get(window, mark), FIRST_DOCUMENT)
        // The reload destroys the page that this asks, so ask again.
        .catch(() => true)
    )
    .not.toBe(true);
  await expect(page).toHaveURL(new RegExp(`${SIGN_IN}$`, "u"));
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  expect(
    await page.evaluate((mark) => sessionStorage.getItem(mark), BROKE)
  ).toBeNull();
}

/**
 * A page loaded before a deploy asks for a chunk the deploy removed. The page
 * reloads once at the same address and loads the current chunks, and the
 * learner never sees the error page.
 */
test("reloads once for a chunk of an earlier deploy instead of showing an error", async ({
  page,
}) => {
  const theme = await openSignIn(page);
  await deployUnder(page);

  const reloaded = page.waitForEvent("load");
  await theme.click();
  await reloaded;

  await expectReloadedWithoutError(page);
});

/**
 * A tab that already reloaded for an earlier deploy keeps that reload's mark. The
 * next deploy still reloads it: the mark holds back a second reload only for the
 * moments in which a chunk still missing after its reload must show its error.
 */
test("reloads a tab again that reloaded for an earlier deploy", async ({
  page,
}) => {
  const theme = await openSignIn(page);
  // The mark that an earlier release wrote, which held no time.
  await page.evaluate(
    (mark) => sessionStorage.setItem(mark, "1"),
    SIGN_IN_MARK
  );
  await deployUnder(page);

  const reloaded = page.waitForEvent("load");
  await theme.click();
  await reloaded;

  await expectReloadedWithoutError(page);
});

/**
 * A page with work the server does not hold yet asks before it goes, and the
 * reader stays. The reload for the missing chunk never happened, so the page
 * keeps its place and draws no error, and the next press reloads it into the
 * current deploy, which no longer asks.
 */
test("keeps a page that a prompt held through its reload, and reloads at the next press", async ({
  page,
}) => {
  const theme = await openSignIn(page);
  await page.evaluate(() => {
    let asked = false;
    window.addEventListener("beforeunload", (event) => {
      if (!asked) {
        asked = true;
        event.preventDefault();
      }
    });
  });
  await deployUnder(page);

  const prompt = page.waitForEvent("dialog");
  await theme.click();
  const dialog = await prompt;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();

  await expect(page.locator("html")).toHaveAttribute(GOING_ATTRIBUTE, "reload");
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  expect(
    await page.evaluate((mark) => sessionStorage.getItem(mark), BROKE)
  ).toBeNull();

  const reloaded = page.waitForEvent("load");
  await theme.click();
  await reloaded;

  await expectReloadedWithoutError(page);
});

/**
 * The network drops under an open page, and a press asks for a chunk the document
 * did not load. The chunk is out of reach, not gone, so the lesson stays on screen:
 * a reload would swap it for the browser's offline screen, and the route's error
 * would swap it for a broken page. The press answers once the network is back.
 */
test("keeps its page when a press asks for a chunk and the network is gone", async ({
  context,
  page,
}) => {
  await page.goto(LESSON_PATH);
  const title = page.getByRole("heading", { level: 1 });
  await waitUntilTakenOver(title);
  const lesson = await title.innerText();

  await context.setOffline(true);
  const failed = page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.addEventListener("vite:preloadError", () => resolve(), {
          once: true,
        });
      })
  );
  await page.getByRole("button", { name: "Search content..." }).first().click();
  await failed;

  await expect(title).toHaveText(lesson);
  await context.setOffline(false);
  await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();
  await expect(title).toHaveText(lesson);
});
