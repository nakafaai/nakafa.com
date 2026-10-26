import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of the task the test publishes. */
const TASK_PATH = /\/classes\/fisika-x-1\/tasks\/latihan-gerak-lurus$/;

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a subject teacher publishes a task, finds it in the class's tasks, and opens its page, at ${viewport.width} px`, async ({
    browser,
    baseURL,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInClassTeacher(context, school.slug, address("/"))
    );
    const page = await context.newPage();
    await page.goto(address("/classes/fisika-x-1/tasks"));
    await expect(page.getByText("No task yet")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    const create = page.getByRole("button", { name: "New task" });
    await waitUntilTakenOver(create);
    await create.click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox", { name: "Title" })
      .fill("Latihan Gerak Lurus");
    await dialog
      .getByRole("textbox", { name: "What to do" })
      .fill("Kerjakan soal 1 sampai 10.");
    await dialog.getByLabel("Deadline").fill("2027-10-30T23:59");
    await dialog.getByRole("button", { name: "Publish" }).click();
    await expect(dialog).toBeHidden();

    const link = page.getByRole("link", { name: "Latihan Gerak Lurus" });
    await expect(link).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await expect(page.getByText("0 handed in")).toBeVisible();
    await link.click();
    await page.waitForURL(TASK_PATH);
    await expect(
      page.getByRole("heading", { name: "Latihan Gerak Lurus", level: 2 })
    ).toBeVisible();
    await expect(page.getByText("Kerjakan soal 1 sampai 10.")).toBeVisible();
    await expect(page.getByText("No work yet")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" })
    ).toContainText("Latihan Gerak Lurus");
    await context.close();
  });
}
