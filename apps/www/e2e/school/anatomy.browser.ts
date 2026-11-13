import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { readAnatomy } from "@/e2e/support/anatomy";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The page's one rhythm under its header or its tab row, `pageRhythmVariants`. */
const RHYTHM = 24;

/** A phone and a desktop: the phone narrows a table's first column, the desktop gives it its full width. */
const WIDTHS = [390, 1440];

/** A PNG of one pixel, which the school takes as its logo, so its card's footer holds two actions. */
const LOGO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

/** Reads one page at each width: its body one rhythm under its header or tab row, and none of the anatomy's faults. */
async function expectAnatomy(page: Page, label: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ height: 844, width });
    await expect
      .poll(
        async () => {
          const anatomy = await readAnatomy(page);
          return { gap: anatomy.gap, problems: anatomy.problems };
        },
        { message: `${label} at ${width}px` }
      )
      .toEqual({ gap: RHYTHM, problems: [] });
  }
}

test("a school's settings start one rhythm under the header, a table fills its card on the screen and leads with a narrow column on a phone, and a footer with two actions keeps its sentence whole", async ({
  baseURL,
  browser,
}) => {
  test.setTimeout(readinessTimeoutMilliseconds * 12);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/profile"));
  const logoCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("School logo", { exact: true }) });
  await expect(logoCard).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await logoCard.locator('input[type="file"]').setInputFiles({
    buffer: LOGO,
    mimeType: "image/png",
    name: "logo.png",
  });
  await expect(
    logoCard.getByRole("button", { name: "Remove logo" })
  ).toBeVisible();
  await expectAnatomy(page, "the profile");

  for (const section of ["members", "audit"]) {
    await page.goto(address(`/settings/${section}`));
    await expect(page.locator('[data-slot="table-card"]')).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expectAnatomy(page, `the ${section} settings`);
  }
  await context.close();
});

test("every tab of a class starts its body one rhythm under the tab row, so a press between them moves nothing", async ({
  baseURL,
  browser,
}) => {
  test.setTimeout(readinessTimeoutMilliseconds * 12);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const page = await context.newPage();
  await page.goto(address("/classes/fisika-x-1"));
  const tabs = page.getByRole("tablist", { name: "Class" });
  await expect(tabs).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  for (const tab of ["Home", "Forum", "Library", "Tasks", "People"]) {
    await tabs.getByRole("tab", { name: tab }).click();
    await expect(tabs.getByRole("tab", { name: tab })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expectAnatomy(page, `the ${tab} tab`);
  }
  await context.close();
});
