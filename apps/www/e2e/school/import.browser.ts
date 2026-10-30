import { type Browser, expect, test } from "@playwright/test";
import { Effect } from "effect";
import { strToU8, zipSync } from "fflate";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** A Word file in the smallest form Word opens: its content types and a main part with one question. */
const wordFile = () =>
  Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'
      ),
      "word/document.xml": strToU8(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>1. Berapa 2 + 3? A. 4 B. 5</w:t></w:r></w:p></w:body></w:document>'
      ),
    })
  );

/**
 * Opens the create dialog of a new school's exam list as its Owner, once React has taken the
 * button over, and answers the page and the dialog.
 */
async function openCreateDialog(browser: Browser, baseURL: string | undefined) {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext();
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  const create = page.getByRole("button", { name: "Create exam" });
  await waitUntilTakenOver(create);
  await create.click();
  return { context, dialog: page.getByRole("dialog"), page };
}

test("a teacher creates an exam from a Word file: the title follows the file, the editor opens, and one toast follows the read", async ({
  baseURL,
  browser,
}) => {
  const { context, dialog, page } = await openCreateDialog(browser, baseURL);

  await dialog.getByLabel("Questions from a file").setInputFiles({
    buffer: wordFile(),
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    name: "PTS Matematika.docx",
  });
  await expect(dialog.getByRole("textbox", { name: "Exam title" })).toHaveValue(
    "PTS Matematika"
  );
  // The field names the chosen file, with a way to remove it.
  await expect(dialog.getByText("PTS Matematika.docx")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Remove file" })
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Create exam" }).click();

  // The editor opens at once with the exam's first question while Nina reads. The local backend
  // has no AI gateway, so the read ends in the toast of a file Nina could not read.
  await page.waitForURL(EDITOR_PATH);
  await expect(
    page.getByRole("textbox", { name: "Question 1 text" })
  ).toBeVisible();
  await expect(page.getByText("Nina could not read this file.")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await context.close();
});

test("a file that is no Word or PDF document is refused in the browser, and the exam keeps its first question", async ({
  baseURL,
  browser,
}) => {
  const { context, dialog, page } = await openCreateDialog(browser, baseURL);

  await dialog.getByLabel("Questions from a file").setInputFiles({
    buffer: Buffer.from("Soal 1. Berapa 2 + 3?"),
    mimeType: "application/pdf",
    name: "soal.pdf",
  });
  await dialog.getByRole("button", { name: "Create exam" }).click();

  await page.waitForURL(EDITOR_PATH);
  await expect(page.getByText("This file cannot be imported.")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(page.getByText("Choose a Word or PDF file.")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Question 1 text" })
  ).toBeVisible();
  await context.close();
});

test("the editor imports a Word file into the open exam from its header menu, as Google Slides imports slides, and a cancelled import keeps no file", async ({
  baseURL,
  browser,
}) => {
  const { context, dialog, page } = await openCreateDialog(browser, baseURL);
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("PTS Fisika");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);

  // The header holds Try as student with the menu of the rarer actions joined to it, in its one row:
  // one button group, so the two share an edge with no inner corners and one border between them.
  const header = page.locator("header").filter({
    has: page.getByRole("button", { name: "More actions" }),
  });
  const tryAction = header.getByRole("link", { name: "Try as student" });
  const moreActions = header.getByRole("button", { name: "More actions" });
  await expect(tryAction).toBeVisible();
  await expect(tryAction).toHaveCSS("border-top-right-radius", "0px");
  await expect(tryAction).toHaveCSS("border-bottom-right-radius", "0px");
  await expect(moreActions).toHaveCSS("border-top-left-radius", "0px");
  await expect(moreActions).toHaveCSS("border-left-width", "0px");
  const openImport = async () => {
    await header.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Import" }).click();
  };
  const importDialog = page.getByRole("dialog");
  const chooseFile = () =>
    importDialog.getByLabel("Questions from a file").setInputFiles({
      buffer: wordFile(),
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      name: "Bab 2.docx",
    });

  // A removed file leaves the field empty, and a file chosen and then cancelled is gone when the
  // dialog opens again.
  await openImport();
  await chooseFile();
  await importDialog.getByRole("button", { name: "Remove file" }).click();
  await expect(importDialog.getByText("Bab 2.docx")).toHaveCount(0);
  await expect(
    importDialog.getByRole("button", { name: "Import" })
  ).toBeDisabled();
  await chooseFile();
  await expect(importDialog.getByText("Bab 2.docx")).toBeVisible();
  await importDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(importDialog).toBeHidden();
  await openImport();
  await expect(
    importDialog.getByRole("button", { name: "Import" })
  ).toBeDisabled();

  await chooseFile();
  await importDialog.getByRole("button", { name: "Import" }).click();

  // The dialog closes at once, and the local backend's missing gateway ends the read in its toast.
  await expect(importDialog).toBeHidden();
  await expect(page.getByText("Nina could not read this file.")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await context.close();
});
