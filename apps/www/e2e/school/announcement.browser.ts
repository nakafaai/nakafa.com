import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The time line of an edited announcement. */
const EDITED = /, edited$/;

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a subject teacher posts an announcement on the class home, finds it after a reload, edits it and removes it, at ${viewport.width} px`, async ({
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
    await page.goto(address("/classes/fisika-x-1"));
    await expect(page.getByText("No announcement yet")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    // The announcement shows at once first on the home, and the dialog closes.
    const create = page.getByRole("button", { name: "New announcement" });
    await waitUntilTakenOver(create);
    await create.click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox", { name: "Announcement" })
      .fill("Ulangan bab 2 hari Senin pukul 07.30.");
    await dialog.getByRole("checkbox", { name: "Also send by email" }).click();
    await dialog.getByRole("button", { name: "Post" }).click();
    await expect(dialog).toBeHidden();
    const posted = page.getByText("Ulangan bab 2 hari Senin pukul 07.30.");
    await expect(posted).toBeVisible();
    await expect(page.getByText("Also sent by email.")).toBeVisible();

    // The server keeps it.
    await page.reload();
    await expect(posted).toBeVisible({ timeout: readinessTimeoutMilliseconds });

    // The author edits it in its place and removes it for good.
    const more = page.getByRole("button", { name: "More actions" });
    await waitUntilTakenOver(more);
    await more.click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page
      .getByRole("textbox", { name: "Edit" })
      .fill("Ulangan bab 2 pindah ke hari Selasa.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByText("Ulangan bab 2 pindah ke hari Selasa.")
    ).toBeVisible();
    await expect(page.getByText(EDITED)).toBeVisible();
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await expect(page.getByText("No announcement yet")).toBeVisible();
    await page.reload();
    await expect(page.getByText("No announcement yet")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await context.close();
  });
}
