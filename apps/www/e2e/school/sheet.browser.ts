import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A phone, where the school's sidebar is a sheet that mounts its copy as it opens. */
const PHONE = { height: 844, width: 390 };

/** A PNG of one pixel, which the school takes as its logo. */
const LOGO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

/** The sidebar's sheet on a phone. */
const SHEET = '[data-mobile="true"][data-slot="sidebar"]';

/** The page global that watches the sheet. */
const WATCH = "nakafaSheet";

/** The class another teacher teaches, which the Owner finds under its unit. */
const CLASS = "Fisika X-1";

/**
 * Watches the sheet as it mounts. What it draws in a frame is the name of each link and whether each picture is
 * drawn: `first` keeps the first frame after the sheet mounts, which paints after the callback that reads it, and
 * `read` reads the frame at hand. The page serializes this function, so its reader lives inside it.
 */
function watchSheet({ key, selector }: { key: string; selector: string }) {
  const read = () => {
    const sheet = document.querySelector(selector);
    return {
      links: Array.from(sheet?.querySelectorAll("a") ?? []).map((link) =>
        (link.textContent ?? "").trim()
      ),
      pictures: Array.from(sheet?.querySelectorAll("img") ?? []).map(
        (picture) => picture.complete && picture.naturalWidth > 0
      ),
    };
  };
  const watch: { first?: ReturnType<typeof read>; read: typeof read } = {
    read,
  };
  Reflect.set(window, key, watch);
  const observer = new MutationObserver(() => {
    if (document.querySelector(selector) === null) {
      return;
    }
    observer.disconnect();
    requestAnimationFrame(() => {
      watch.first = read();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

/** Opens the sidebar's sheet, and answers what it drew in its first frame and once its reads settled. */
async function openSheet(page: Page) {
  await page.evaluate(watchSheet, { key: WATCH, selector: SHEET });
  await page
    .locator('[data-sidebar="trigger"]')
    .filter({ visible: true })
    .first()
    .click();
  await expect(
    page.locator(SHEET).getByRole("link", { exact: true, name: CLASS })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await page.waitForLoadState("networkidle");
  return page.evaluate((key) => {
    const watch = Reflect.get(window, key);
    return { first: watch.first, settled: watch.read() };
  }, WATCH);
}

/**
 * The school's sidebar opens whole on a phone: the sheet mounts its copy as it opens, and that copy draws every class
 * and the school's logo in its first frame, as the copy beside the page already holds them, so nothing is added or
 * painted under the reader's eyes. It stays so on every open.
 */
test("a leader's phone sidebar draws every class and the school's logo in its first frame", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  // Another teacher's class, which the Owner reads through its unit's paginated list.
  const teacher = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(teacher, school.slug, address("/"))
  );
  await teacher.close();

  const context = await browser.newContext({
    recordVideo: { dir: test.info().outputPath("video"), size: PHONE },
    viewport: PHONE,
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/settings/profile"));
  const logoCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("School logo", { exact: true }) });
  await logoCard.locator('input[type="file"]').setInputFiles({
    buffer: LOGO,
    mimeType: "image/png",
    name: "logo.png",
  });
  await expect(
    logoCard.getByRole("button", { name: "Remove logo" })
  ).toBeVisible();

  await page.goto(address("/"));
  await waitUntilTakenOver(
    page.locator('[data-sidebar="trigger"]').filter({ visible: true }).first()
  );
  // The copy beside the page, hidden on a phone, has read the unit's classes.
  await expect(
    page.locator('[data-slot="sidebar-inner"] a', { hasText: CLASS })
  ).toBeAttached({ timeout: readinessTimeoutMilliseconds });
  await page.waitForLoadState("networkidle");

  for (const open of ["first", "second"]) {
    const { first, settled } = await openSheet(page);
    expect(settled.links, `the ${open} open lists the class`).toContain(CLASS);
    expect(settled.pictures, `the ${open} open draws the logo`).toContain(true);
    expect(first, `the ${open} open's first frame`).toEqual({
      links: settled.links,
      pictures: settled.pictures.map(() => true),
    });
    await page.keyboard.press("Escape");
    await expect(page.locator(SHEET)).toHaveCount(0);
  }
  await context.close();
});
