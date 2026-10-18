// Takes the pictures of a school host (nakafa #1072, #1112) at 390 and 1440 px in both
// themes: the sign-in surface of a visitor, the shell of a member, the account
// menu and its languages, a failed language change, the not-found page of a
// school, and the page a refused visitor gets. Copy it to
// apps/www/e2e/school/zshots.browser.ts of that worktree (never commit it).
import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";

const SHOTS = process.env.SHOTS_DIR ?? "";

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
}

async function openAccount(page: Page) {
  const account = page.getByRole("button", { name: "Acceptance Owner", exact: true });
  if (!(await account.isVisible())) {
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  }
  await account.click();
}

for (const [width, height] of [
  [390, 844],
  [1440, 900],
] as const) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`${width} ${theme}`, () => {
      test.use({ colorScheme: theme, viewport: { height, width } });

      test(`school host at ${width} in ${theme}`, async ({
        browser,
        baseURL,
      }) => {
        test.setTimeout(180_000);
        const tag = `${width}-${theme}`;
        const school = await Effect.runPromise(createSchool());
        const host = `${school.slug}.localhost`;
        const schoolHome = hostAddress(baseURL, host, "/");

        const guest = await browser.newContext({
          colorScheme: theme,
          viewport: { height, width },
        });
        const guestPage = await guest.newPage();
        await guestPage.goto(schoolHome);
        if (width >= 1024) {
          await expect(guestPage.locator('[data-slot="pool"]')).toHaveAttribute(
            "data-shown",
            "true",
            { timeout: 30_000 }
          );
        }
        await settle(guestPage);
        await guestPage.screenshot({
          fullPage: true,
          path: `${SHOTS}/${tag}-01-guest.png`,
        });
        await guest.close();

        const context = await browser.newContext({
          colorScheme: theme,
          viewport: { height, width },
        });
        await Effect.runPromise(signInOwner(context, school.slug, schoolHome));
        const page = await context.newPage();
        await page.goto(schoolHome);
        await expect(
          page.getByText("You are signed in as Owner.")
        ).toBeVisible();
        await settle(page);
        await page.screenshot({ path: `${SHOTS}/${tag}-02-member.png` });

        await openAccount(page);
        await settle(page);
        await page.screenshot({ path: `${SHOTS}/${tag}-03-account.png` });

        await page.getByRole("menuitem", { name: "Language" }).click();
        await settle(page);
        await page.screenshot({ path: `${SHOTS}/${tag}-04-language.png` });

        await page.route("**/*", (route) =>
          route.request().method() === "POST" &&
          route.request().headers()["next-action"]
            ? route.abort()
            : route.continue()
        );
        await page.getByRole("menuitem", { name: "Indonesia" }).click();
        await expect(
          page.getByText("We could not change the language.")
        ).toBeVisible();
        await settle(page);
        await page.screenshot({
          path: `${SHOTS}/${tag}-05-language-failed.png`,
        });
        await page.unroute("**/*");

        await page.goto(hostAddress(baseURL, host, "/classes/fisika"));
        await expect(
          page.getByRole("heading", { level: 1, name: "We can't find this page" })
        ).toBeVisible();
        await settle(page);
        await page.screenshot({ path: `${SHOTS}/${tag}-06-school-missing.png` });
        await context.close();

        const refused = await browser.newContext({
          colorScheme: theme,
          extraHTTPHeaders: { "x-next-intl-locale": "en" },
          viewport: { height, width },
        });
        const refusedPage = await refused.newPage();
        await refusedPage.goto(
          hostAddress(baseURL, "nosuchschool.localhost", "/_not-found")
        );
        await settle(refusedPage);
        await refusedPage.screenshot({
          path: `${SHOTS}/${tag}-07-refused.png`,
        });
        await refused.close();
      });
    });
  }
}
