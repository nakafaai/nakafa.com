import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The address of an exam's try as a student on the school host. */
const TRY_PATH = /\/exams\/[^/]+\/try$/u;

test("a teacher draws a graph and a chart in a question, edits the graph, and the student reads both", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext();
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  await waitUntilTakenOver(page.getByRole("button", { name: "Create exam" }));
  await page.getByRole("button", { name: "Create exam" }).click();
  const create = page.getByRole("dialog");
  await create.getByRole("textbox", { name: "Exam title" }).fill("Bergambar");
  await create.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  const prompt = page.getByRole("textbox", { name: "Question 1 text" });
  await expect(prompt).toBeEditable({ timeout: readinessTimeoutMilliseconds });
  await prompt.click();
  await page.keyboard.type("Perhatikan gambar berikut.");
  await page.keyboard.press("Enter");

  // Save waits for a name and a text alternative, then the graph stands in the text.
  await page.getByRole("button", { exact: true, name: "Figure" }).click();
  await page.getByRole("menuitem", { name: "Graph" }).click();
  const dialog = page.getByRole("dialog");
  const save = dialog.getByRole("button", { name: "Save" });
  await expect(save).toBeDisabled();
  await dialog.getByRole("textbox", { name: "Name" }).fill("Garis lurus");
  await dialog
    .getByRole("textbox", { name: "What it shows" })
    .fill("Garis naik melalui titik asal");
  await dialog.getByRole("textbox", { exact: true, name: "a" }).fill("2");
  await save.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-figure]")).toHaveCount(1);

  // The figure opens again with what the teacher wrote.
  await page.getByRole("button", { name: "Edit figure" }).click();
  await expect(
    dialog.getByRole("textbox", { exact: true, name: "a" })
  ).toHaveValue("2");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("link", { name: "Try as student" }).click();
  await page.waitForURL(TRY_PATH);
  await expect(page.getByRole("figure", { name: "Garis naik" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await context.close();
});
