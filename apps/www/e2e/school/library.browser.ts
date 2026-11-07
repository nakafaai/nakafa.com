import { expect, type Page, test } from "@playwright/test";
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

/** The address of one folder of the class's library. */
const FOLDER_ADDRESS = /\/classes\/fisika-x-1\/library\/[^/]+$/u;

/** A presigned R2 upload: path style, with the length and type it binds. */
const R2_UPLOAD =
  /\/r2\/nakafa-files\/library\/.+X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost/u;

/** The leading bytes of a PDF, which the server keeps. */
const PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");

/** Opens the menu of the row whose name holds `name`. */
const openMenu = async (page: Page, name: string) => {
  const more = page
    .getByRole("row", { name: new RegExp(name, "u") })
    .getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(more);
  await more.click();
};

/** Adds a link to the folder the page shows. */
const addLink = async (page: Page, title: string) => {
  const dialog = page.getByRole("dialog");
  await page.getByRole("button", { name: "Add to library" }).click();
  await dialog.getByRole("tab", { name: "Link" }).click();
  await dialog
    .getByRole("textbox", { name: "Address" })
    .fill(`https://example.com/${title.length}`);
  await dialog.getByRole("textbox", { name: "Title" }).fill(title);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: title })).toBeVisible();
};

/** Makes a folder inside the folder the page shows. */
const addFolder = async (page: Page, name: string) => {
  const dialog = page.getByRole("dialog");
  const create = page.getByRole("button", { name: "New folder" });
  await waitUntilTakenOver(create);
  await create.click();
  await dialog.getByRole("textbox", { name: "Name" }).fill(name);
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("link", { exact: true, name })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
};

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a subject teacher is told to connect Drive first, uploads a PDF straight to R2 with its progress, opens it at a signed address, sees a refused file leave, and trashes a link, at ${viewport.width} px`, async ({
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
    await dialog.getByRole("tab", { name: "Link" }).click();
    await dialog
      .getByRole("textbox", { name: "Address" })
      .fill("https://example.com/gerak-lurus");
    await dialog
      .getByRole("textbox", { name: "Title" })
      .fill("Video gerak lurus");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Video gerak lurus" })
    ).toBeVisible();

    const upload = page.waitForRequest(
      (request) => request.method() === "PUT" && R2_UPLOAD.test(request.url())
    );
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
    // The bytes go straight to the bucket, never through the Worker.
    expect((await upload).headers()["content-type"]).toBe("application/pdf");
    const module = page.getByRole("button", { name: "Modul gerak lurus" });
    await expect(module).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await expect(page.getByText("100%")).toHaveCount(0, {
      timeout: readinessTimeoutMilliseconds,
    });

    await openMenu(page, "Modul gerak lurus");
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Download" }).click();
    expect((await download).suggestedFilename()).toBe("Modul gerak lurus.pdf");

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

    await openMenu(page, "Video gerak lurus");
    await page.getByRole("menuitem", { name: "Move to trash" }).click();
    await expect(
      page.getByRole("button", { name: "Video gerak lurus" })
    ).toBeHidden();
    await expect(module).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      )
    ).toBeLessThanOrEqual(0);
    await context.close();
  });
}

test("a subject teacher nests folders, uploads into the deepest, moves the file and a folder, trashes, restores and deletes forever", async ({
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
  const dialog = page.getByRole("dialog");
  await page.goto(address("/classes/fisika-x-1/library"));
  await addFolder(page, "Bab 1");
  await page.getByRole("link", { exact: true, name: "Bab 1" }).click();
  await page.waitForURL(FOLDER_ADDRESS);
  await addFolder(page, "Gerak lurus");
  await page.getByRole("link", { exact: true, name: "Gerak lurus" }).click();
  const path = page.getByRole("navigation", { name: "Folder path" });
  await expect(path).toContainText("Library");
  await expect(path).toContainText("Bab 1");
  await expect(path).toContainText("Gerak lurus");

  // A file added in the deepest folder uploads into it.
  await page.getByRole("button", { name: "Add to library" }).click();
  await dialog.getByLabel("File").setInputFiles({
    buffer: PDF_BYTES,
    mimeType: "application/pdf",
    name: "Modul GLB.pdf",
  });
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Modul GLB" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await addLink(page, "Simulasi");

  // The Move dialog sends the file to the top of the library.
  await openMenu(page, "Modul GLB");
  await page.getByRole("menuitem", { exact: true, name: "Move" }).click();
  await dialog.getByRole("button", { name: "Library" }).click();
  await dialog.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByRole("button", { name: "Modul GLB" })).toBeHidden();

  await path.getByRole("link", { name: "Library" }).click();
  await expect(page.getByRole("button", { name: "Modul GLB" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });

  // A folder moved to the top keeps what it holds.
  await page.getByRole("link", { exact: true, name: "Bab 1" }).click();
  await page.waitForURL(FOLDER_ADDRESS);
  await openMenu(page, "Gerak lurus");
  await page.getByRole("menuitem", { exact: true, name: "Move" }).click();
  await dialog.getByRole("button", { name: "Library" }).click();
  await dialog.getByRole("button", { name: "Move", exact: true }).click();
  await expect(
    page.getByRole("link", { exact: true, name: "Gerak lurus" })
  ).toBeHidden();
  await path.getByRole("link", { name: "Library" }).click();
  await page.getByRole("link", { exact: true, name: "Gerak lurus" }).click();
  await expect(page.getByRole("button", { name: "Simulasi" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });

  // The trash keeps the file until it is restored, then deletes it forever.
  await path.getByRole("link", { name: "Library" }).click();
  await openMenu(page, "Modul GLB");
  await page.getByRole("menuitem", { name: "Move to trash" }).click();
  await expect(page.getByRole("button", { name: "Modul GLB" })).toBeHidden();
  await page.getByRole("tab", { name: "Trash" }).click();
  await expect(page.getByText("Modul GLB")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await openMenu(page, "Modul GLB");
  await page.getByRole("menuitem", { name: "Restore" }).click();
  await page.getByRole("tab", { name: "Files" }).click();
  await expect(page.getByRole("button", { name: "Modul GLB" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await openMenu(page, "Modul GLB");
  await page.getByRole("menuitem", { name: "Move to trash" }).click();
  await page.getByRole("tab", { name: "Trash" }).click();
  await openMenu(page, "Modul GLB");
  await page.getByRole("menuitem", { name: "Delete forever" }).click();
  await dialog.getByRole("button", { name: "Delete forever" }).click();
  await expect(page.getByText("The trash is empty")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await context.close();
});
