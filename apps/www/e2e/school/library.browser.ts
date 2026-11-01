import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** Where the dialog sends a teacher without Drive: the account's connections. */
const CONNECTIONS_ADDRESS = /\/en\/user\/settings\/connectors$/u;

/** The row of the link the test adds. */
const VIDEO_ROW = /Video gerak lurus/u;

/** The address of one folder of the class's library. */
const FOLDER_ADDRESS = /\/classes\/fisika-x-1\/library\/[^/]+$/u;

/** The leading bytes of a PDF, which the server keeps. */
const PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a subject teacher is told to connect Drive first, adds a link and a PDF to the class library, sees a refused file leave, and removes an item, at ${viewport.width} px`, async ({
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
    // The teacher has no Drive yet: the dialog says so and links to the account's connections.
    await dialog.getByRole("tab", { name: "Drive" }).click();
    await dialog.getByRole("button", { name: "Choose from Drive" }).click();
    await expect(dialog.getByText("Connect Google Drive first.")).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: "Open connections" })
    ).toHaveAttribute("href", CONNECTIONS_ADDRESS);
    await expect(
      dialog.getByRole("button", { name: "Add", exact: true })
    ).toBeDisabled();
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

test("a subject teacher makes a folder, moves a link into it, adds another inside, renames it, and deletes it, and the links stay", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const page = await context.newPage();
  await page.goto(address("/classes/fisika-x-1/library"));
  const create = page.getByRole("button", { name: "New folder" });
  await waitUntilTakenOver(create);
  await create.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Create" })).toBeDisabled();
  await dialog.getByRole("textbox", { name: "Name" }).fill("Bab 1");
  await dialog.getByRole("button", { name: "Create" }).click();
  const folder = page.getByRole("link", { name: "Bab 1" });
  await expect(folder).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  const add = page.getByRole("button", { name: "Add to library" });
  const addLink = async (title: string) => {
    await add.click();
    await dialog.getByRole("tab", { name: "Link" }).click();
    await dialog
      .getByRole("textbox", { name: "Address" })
      .fill(`https://example.com/${title.length}`);
    await dialog.getByRole("textbox", { name: "Title" }).fill(title);
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  };
  await addLink("Video gerak lurus");

  // The link moves out of the top of the library the moment it is saved.
  await page
    .getByRole("row", { name: VIDEO_ROW })
    .getByRole("button", { name: "More actions" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await dialog.getByRole("combobox", { name: "Folder" }).click();
  await page.getByRole("option", { name: "Bab 1" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("link", { name: "Video gerak lurus" })
  ).toBeHidden();

  await folder.click();
  await page.waitForURL(FOLDER_ADDRESS);
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" })
  ).toContainText("Bab 1");
  await expect(
    page.getByRole("link", { name: "Video gerak lurus" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(page.getByRole("button", { name: "New folder" })).toHaveCount(0);
  await waitUntilTakenOver(add);
  await addLink("Soal latihan");

  // An address that names no folder of the class shows the class's missing state.
  const folderAddress = page.url();
  await page.goto(address("/classes/fisika-x-1/library/bukan-folder"));
  await expect(page.getByRole("link", { name: "Soal latihan" })).toHaveCount(0);

  await page.goto(address("/classes/fisika-x-1/library"));
  const row = page.getByRole("row", { name: "Bab 1" });
  const more = row.getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(more);
  await more.click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await dialog.getByRole("textbox", { name: "Name" }).fill("Gerak lurus");
  await dialog.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("link", { name: "Gerak lurus" })).toBeVisible();

  await page
    .getByRole("row", { name: "Gerak lurus" })
    .getByRole("button", { name: "More actions" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByRole("link", { name: "Gerak lurus" })).toBeHidden();
  await expect(
    page.getByRole("link", { name: "Video gerak lurus" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(page.getByRole("link", { name: "Soal latihan" })).toBeVisible();
  await page.goto(folderAddress);
  await expect(page.getByRole("link", { name: "Soal latihan" })).toHaveCount(0);
  await context.close();
});
