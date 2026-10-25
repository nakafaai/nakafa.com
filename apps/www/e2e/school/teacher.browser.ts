import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { holdWebFont } from "@/e2e/support/state";
import {
  desktopViewport,
  touchViewport,
  viewportSize,
} from "@/e2e/support/viewport";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

for (const viewport of [touchViewport, desktopViewport]) {
  test(`a school with no exam offers its one step, Create exam, in the middle of the page at ${viewport.width} px`, async ({
    browser,
    baseURL,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const host = `${school.slug}.localhost`;
    const context = await browser.newContext({
      hasTouch: viewport.hasTouch,
      viewport: viewportSize(viewport),
    });
    await Effect.runPromise(
      signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
    );
    const page = await context.newPage();
    // The web font swaps in after the first paint and moves the centred title sideways, which
    // is the site's font strategy, not this page: without it, whatever moves is the page's own.
    await Effect.runPromise(holdWebFont(page));

    await page.goto(hostAddress(baseURL, host, "/exams"));

    // The page holds one create action, in the empty state with Nina, and none in the header.
    const header = page.locator('header[data-slot="page-header"]');
    const create = page.getByRole("button", { name: "Create exam" });
    await expect(
      page.getByText("There are no exams yet.", { exact: true })
    ).toBeVisible();
    await expect(create).toHaveCount(1);
    await expect(create).toBeInViewport();
    await expect(
      header.getByRole("button", { name: "Create exam" })
    ).toHaveCount(0);
    await page.waitForLoadState("load");
    expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);

    // The step opens the create dialog, and the new exam opens in its editor.
    await waitUntilTakenOver(create);
    await create.click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox", { name: "Exam title" })
      .fill("PTS Matematika");
    await dialog.getByRole("button", { name: "Create exam" }).click();
    await page.waitForURL(EDITOR_PATH);

    // Back on the list, the exam is listed and the create action moves to the header.
    await page.goto(hostAddress(baseURL, host, "/exams"));
    await expect(
      page.getByRole("link", { name: "PTS Matematika" })
    ).toBeVisible();
    await expect(
      page.getByText("There are no exams yet.", { exact: true })
    ).toHaveCount(0);
    await expect(
      header.getByRole("button", { name: "Create exam" })
    ).toBeVisible();
    await expect(create).toHaveCount(1);
    await context.close();
  });
}
