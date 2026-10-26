import { expect, test } from "@playwright/test";
import standalone from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import { HashSet } from "effect";

const SIGN_IN = "/en/auth";
/** The sign-in page's title, in English. */
const TITLE = "Sign in to Nakafa";
/** The window mark of the first document, which a reload replaces. */
const FIRST_DOCUMENT = "nakafaFirstDocument";
/** The tab's storage mark set if any document of the test ever drew the error state. */
const BROKE = "nakafa-e2e-drew-error";

/**
 * A page loaded before a deploy asks for a chunk the deploy removed. The page
 * reloads once at the same address and loads the current chunks, and the
 * learner never sees the error page. Here every chunk that the first document
 * did not load answers 404 until the page loads again, as the chunks of an
 * earlier deploy do once the next deploy is live.
 */
test("reloads once for a chunk of an earlier deploy instead of showing an error", async ({
  page,
}) => {
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
  await expect(theme).toBeVisible();
  await expect
    .poll(() =>
      theme.evaluate((node) =>
        Object.keys(node).some((key) => key.startsWith("__reactProps$"))
      )
    )
    .toBe(true);

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

  await theme.click();

  await expect
    .poll(() =>
      page.evaluate((mark) => Reflect.get(window, mark), FIRST_DOCUMENT)
    )
    .not.toBe(true);
  await expect(page).toHaveURL(new RegExp(`${SIGN_IN}$`));
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  expect(
    await page.evaluate((mark) => sessionStorage.getItem(mark), BROKE)
  ).toBeNull();
});
