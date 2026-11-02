import { expect, type Page, test } from "@playwright/test";
import { Effect, Record as Rec } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import {
  expectNoOverflow,
  readCumulativeLayoutShift,
} from "@/e2e/support/layout";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/**
 * The longest names a school's people bring, one per language, each under the 120 characters a
 * person's name may hold: Javanese nobility, an English double barrel, a German compound and an
 * Arabic chain of names, which reads right to left.
 */
const NAMES = {
  arabic: "محمد عبد الرحمن بن عبد الله بن إبراهيم الفاروقي الهاشمي القرشي",
  english:
    "Alexandra Catherine Montgomery-Fitzwilliam-Worthington the Third of Kensington",
  german:
    "Maximilian Donaudampfschifffahrtsgesellschaftskapitänswitwenrentenberechtigter",
  indonesian:
    "Raden Mas Muhammad Abdurrahman Al-Faruqi bin Abdullah Saputra Wijayakusuma Hadiningrat",
};

/** The page languages a school host serves, by the cookie that chooses one. */
const LOCALES = ["en", "id", "de"] as const;

/** The pages that list the invited people by name. */
const PEOPLE_PAGES = ["/settings/invites", "/settings/members"];

/** Invites one person by name, as a Teacher, from the Invites page that `page` shows. */
async function invite(page: Page, name: string, email: string) {
  const action = page
    .locator("header")
    .getByRole("button", { exact: true, name: "Invite" });
  await waitUntilTakenOver(action);
  await action.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByRole("button", { exact: true, name: "Invite" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

test("the longest names in Indonesian, English, German and Arabic fit every people page in every language, phone and desktop, without moving", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  const changes = await Effect.runPromise(trackChanges(page, []));
  await page.goto(address("/settings/invites"));
  for (const [key, name] of Rec.toEntries(NAMES)) {
    const sentBefore = changes.sent;
    await invite(page, name, `${key}-${school.slug}@acceptance.example.test`);
    // The row shows before the server has the invite, and the reload below drops one still on its way.
    await saved(changes, sentBefore);
  }

  for (const locale of LOCALES) {
    await context.addCookies([
      { name: "NAKAFA_LOCALE", url: address("/"), value: locale },
    ]);
    for (const viewport of [
      { height: 844, width: 390 },
      { height: 900, width: 1440 },
    ]) {
      await page.setViewportSize(viewport);
      for (const path of PEOPLE_PAGES) {
        const label = `${locale} ${viewport.width} ${path}`;
        await page.goto(address(path));
        for (const name of Rec.values(NAMES)) {
          await expect(
            page.getByText(name, { exact: true }).first(),
            label
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
        }
        // The Arabic name reads right to left wherever it shows, in a page of any language.
        expect(
          await page
            .getByText(NAMES.arabic, { exact: true })
            .first()
            .evaluate((element) => getComputedStyle(element).direction),
          label
        ).toBe("rtl");
        await Effect.runPromise(expectNoOverflow(page, label));
        await page.waitForLoadState("load");
        expect(
          await Effect.runPromise(readCumulativeLayoutShift(page)),
          label
        ).toBe(0);
      }
    }
  }
  await context.close();
});
