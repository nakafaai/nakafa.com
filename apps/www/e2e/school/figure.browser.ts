import { expect, test } from "@playwright/test";
import { Array as Arr, Effect, MutableList } from "effect";
import { lazyRendererModules } from "#www/output.config";
import {
  builtChunks,
  recordScripts,
  rendererChunks,
} from "@/e2e/support/chunks";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The design-system module of the lab the teacher places, `VirusStructureLab`. */
const LAB_MODULE = "components/contents/biology/virus/structure";

/** The address of an exam's try as a student on the school host. */
const TRY_PATH = /\/exams\/[^/]+\/try$/u;

test("a teacher places a lab of the lesson catalog in a question, edits it, and the student reads it", async ({
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
  await page.keyboard.type("Perhatikan model virion berikut.");
  await page.keyboard.press("Enter");

  // The dialog opens on a chart; the teacher picks a 3D lab of the catalog, and save waits for
  // the props its schema needs.
  // A phone's toolbar row has no room for the figure control, so it waits behind More.
  const more = page
    .getByRole("toolbar")
    .getByRole("button", { exact: true, name: "More" });
  if (await more.isVisible()) {
    await more.click();
  }
  await page.getByRole("button", { exact: true, name: "Figure" }).click();
  // The figure dialog by its title: the visual picker opens a dialog of its own inside it.
  const dialog = page.getByRole("dialog", { exact: true, name: "Figure" });
  const save = dialog.getByRole("button", { name: "Save" });
  await dialog.getByRole("button", { name: "Chart" }).click();
  await page
    .getByRole("combobox", { name: "Search visuals" })
    .fill("VirusStructure");
  await page.getByRole("option", { name: "VirusStructureLab" }).click();
  await expect(save).toBeDisabled();
  await dialog
    .getByRole("textbox", { exact: true, name: "Title" })
    .fill("Virion");
  await dialog
    .getByRole("textbox", { exact: true, name: "Description" })
    .fill("Putar model untuk melihat kapsid.");
  await dialog.getByRole("textbox", { name: "Choose mode" }).fill("Bagian");
  await dialog
    .getByRole("textbox", { name: "View label" })
    .fill("Model virion");
  await dialog
    .getByRole("textbox", { exact: true, name: "Tab" })
    .fill("Kapsid");
  await dialog
    .getByRole("textbox", { name: "What it shows" })
    .fill("Model virion dengan kapsid");
  await expect(save).toBeEnabled();
  await dialog.screenshot({ path: test.info().outputPath("editor-lab.png") });
  await save.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-figure]")).toHaveCount(1);

  // The figure opens again with what the teacher wrote, through the same schema.
  await page.getByRole("button", { name: "Edit figure" }).click();
  await expect(
    dialog.getByRole("textbox", { exact: true, name: "Tab" })
  ).toHaveValue("Kapsid");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);

  // The student's sitting opens in a page of its own, so the scripts it loads are its own.
  const tryHref = await page
    .getByRole("link", { name: "Try as student" })
    .getAttribute("href");
  const sitting = await context.newPage();
  const scripts = recordScripts(sitting);
  await sitting.goto(new URL(tryHref ?? "", page.url()).toString());
  await sitting.waitForURL(TRY_PATH);
  const figure = sitting.getByRole("figure", {
    name: "Model virion dengan kapsid",
  });
  await expect(figure).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(figure.locator("canvas")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await figure.screenshot({ path: test.info().outputPath("sitting-lab.png") });

  // Every lazy renderer of the catalog has a chunk of its own, and the sitting loaded the lab's
  // chunk and no other renderer's.
  const chunks = await Effect.runPromise(builtChunks);
  const loaded = MutableList.takeAll(scripts);
  const modules = lazyRendererModules();
  expect(
    Arr.filter(modules, (module) => rendererChunks(chunks, module).length !== 1)
  ).toEqual([]);
  expect(loaded).toEqual(
    expect.arrayContaining(rendererChunks(chunks, LAB_MODULE))
  );
  const others = Arr.flatMap(modules, (module) =>
    module === LAB_MODULE ? [] : rendererChunks(chunks, module)
  );
  expect(Arr.intersection(others, loaded)).toEqual([]);
  await context.close();
});
