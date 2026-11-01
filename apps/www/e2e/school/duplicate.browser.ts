import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The words a copy adds to its exam's title. */
const COPY_TITLE = "Uji coba salin (copy)";

test("a teacher copies a draft from the list's row and from the editor's menu, and each copy opens to take changes", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/exams"));
  const create = page.getByRole("button", { name: "Create exam" });
  await waitUntilTakenOver(create);
  await create.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Uji coba salin");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  const editor = page.url();

  // The editor's menu copies the exam it stands on.
  const menu = page.getByRole("group", { name: "Exam actions" });
  await waitUntilTakenOver(menu.getByRole("button").last());
  await menu.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "Duplicate exam" }).click();
  await expect.poll(() => page.url()).not.toBe(editor);
  await expect(page.getByRole("textbox", { name: "Exam title" })).toHaveValue(
    COPY_TITLE,
    { timeout: readinessTimeoutMilliseconds }
  );
  await expect(
    page.getByRole("textbox", { name: "Question 1 text" })
  ).toBeEditable({ timeout: readinessTimeoutMilliseconds });

  // The list's row copies an exam without opening it first.
  await page.goto(address("/exams"));
  const row = page.getByRole("row", { name: /^Uji coba salin(?! \(copy\))/u });
  await expect(row).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await row.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Duplicate exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await expect(page.getByRole("textbox", { name: "Exam title" })).toHaveValue(
    COPY_TITLE,
    { timeout: readinessTimeoutMilliseconds }
  );
  await context.close();
});
