import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The end of an editor's address, which the try's address replaces. */
const EDIT_SUFFIX = /\/edit$/u;

/** The top of the player's header row, which is the school page's header. */
function headerTop() {
  const header = document.querySelector('header[data-slot="page-header"]');
  return Math.round(header?.getBoundingClientRect().top ?? -1);
}

test("on a phone the player's header stands at the top of the school's page", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  await waitUntilTakenOver(page.getByRole("button", { name: "Create exam" }));
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Ponsel");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await expect(
    page.getByRole("textbox", { name: "Question 1 text" })
  ).toBeEditable({ timeout: readinessTimeoutMilliseconds });

  // The school has no app header above its pages, so no gap opens above the player's header.
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(page.url().replace(EDIT_SUFFIX, "/try"));
  // The try's one action returns to the editor, so the header is drawn once it shows.
  await expect(
    page.getByRole("link", { exact: true, name: "Finish trying" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  // A sticky header placed below where it rests opens the gap at rest too, so the page's first paint shows it.
  expect(await page.evaluate(headerTop)).toBe(0);
  await context.close();
});
