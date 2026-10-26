import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The row of the link the test adds. */
const VIDEO_ROW = /Video gerak lurus/;

/** The leading bytes of a PDF, which the server keeps. */
const PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a subject teacher adds a link and a PDF to the class library, sees a refused file leave, and removes an item, at ${viewport.width} px`, async ({
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
    await page.goto(address("/classes/fisika-x-1/library"));
    await expect(page.getByText("Nothing here yet")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    const add = page.getByRole("button", { name: "Add to library" });
    await waitUntilTakenOver(add);
    const dialog = page.getByRole("dialog");

    await add.click();
    await dialog.getByRole("tab", { name: "Link" }).click();
    await dialog
      .getByRole("textbox", { name: "Address" })
      .fill("https://example.com/gerak-lurus");
    await dialog
      .getByRole("textbox", { name: "Title" })
      .fill("Video gerak lurus");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog).toBeHidden();
    const video = page.getByRole("link", { name: "Video gerak lurus" });
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute(
      "href",
      "https://example.com/gerak-lurus"
    );
    await expect(video).toHaveAttribute("target", "_blank");

    await add.click();
    await dialog.getByLabel("File").setInputFiles({
      buffer: PDF_BYTES,
      mimeType: "application/pdf",
      name: "Modul gerak lurus.pdf",
    });
    await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue(
      "Modul gerak lurus"
    );
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Modul gerak lurus")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Modul gerak lurus" })
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

    await add.click();
    await dialog.getByLabel("File").setInputFiles({
      buffer: Buffer.from("not a document"),
      mimeType: "application/pdf",
      name: "Catatan.pdf",
    });
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("The file was not added.")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(page.getByText("Catatan", { exact: true })).toBeHidden();

    await page
      .getByRole("row", { name: VIDEO_ROW })
      .getByRole("button", { name: "More actions" })
      .click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(video).toBeHidden();
    await expect(
      page.getByRole("link", { name: "Modul gerak lurus" })
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      )
    ).toBeLessThanOrEqual(0);
    await context.close();
  });
}
