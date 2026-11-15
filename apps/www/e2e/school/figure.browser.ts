import { type Browser, expect, type Page, test } from "@playwright/test";
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

/** The screens a teacher builds a figure on: a phone, a tablet and a desktop. */
const SCREENS = [
  { height: 844, width: 390 },
  { height: 1024, width: 768 },
  { height: 900, width: 1440 },
] as const;

/**
 * Signs a school's owner in, creates an exam, writes its first question's words, and opens the
 * figure dialog under them. A phone's toolbar row has no room for the figure control, so it waits
 * behind More. The dialog is found by its title: the visual picker opens a dialog of its own inside it.
 */
const openFigureDialog = async (
  browser: Browser,
  baseURL: string | undefined,
  words: string
) => {
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
  await page.keyboard.type(words);
  await page.keyboard.press("Enter");
  const more = page
    .getByRole("toolbar")
    .getByRole("button", { exact: true, name: "More" });
  if (await more.isVisible()) {
    await more.click();
  }
  await page.getByRole("button", { exact: true, name: "Figure" }).click();
  const dialog = page.getByRole("dialog", { exact: true, name: "Figure" });
  return { context, dialog, page };
};

/** Picks one visual of the catalog in the figure dialog, which opens on a chart. */
const pickVisual = async (page: Page, query: string, name: string) => {
  await page
    .getByRole("dialog", { exact: true, name: "Figure" })
    .getByRole("button", { name: "Chart" })
    .click();
  await page.getByRole("combobox", { name: "Search visuals" }).fill(query);
  await page.getByRole("option", { exact: true, name }).click();
};

/** Adds one object or a slider from the graph builder's add menu. */
const add = async (page: Page, name: string) => {
  await page
    .getByRole("dialog", { exact: true, name: "Figure" })
    .getByRole("button", { exact: true, name: "Add" })
    .click();
  await page.getByRole("menuitem", { exact: true, name }).click();
};

test("a teacher places a lab of the lesson catalog in a question, edits it, and the student reads it", async ({
  baseURL,
  browser,
}) => {
  // The dialog opens on a chart; the teacher picks a 3D lab of the catalog, and save waits for
  // the props its schema needs.
  const { context, dialog, page } = await openFigureDialog(
    browser,
    baseURL,
    "Perhatikan model virion berikut."
  );
  const save = dialog.getByRole("button", { name: "Save" });
  await pickVisual(page, "VirusStructure", "VirusStructureLab");
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
  await page.keyboard.press("Escape");
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

test("a teacher builds a graph of a function, a slider, a labelled point and a vector, turns it into space and back, edits it, and the student reads it", async ({
  baseURL,
  browser,
}, testInfo) => {
  // Picking MathVisual opens the graph builder on a function already drawn; Save waits for a name
  // and a text alternative.
  const { context, dialog, page } = await openFigureDialog(
    browser,
    baseURL,
    "Perhatikan gambar berikut."
  );
  await pickVisual(page, "MathVisual", "MathVisual");
  const save = dialog.getByRole("button", { name: "Save" });
  // The assessment figure, around the visual card's own figure.
  const preview = dialog.getByRole("figure").first();
  await expect(preview).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(save).toBeDisabled();
  await dialog.getByRole("textbox", { name: "Name" }).fill("Parabola");
  await dialog
    .getByRole("textbox", { name: "What it shows" })
    .fill("Parabola dengan titik A dan vektor");

  // A slider a scales the function, and a point and a vector join it, each edited where it stands.
  await add(page, "Slider");
  await expect(dialog.getByRole("group", { name: "Slider a" })).toBeVisible();
  const curve = dialog.getByRole("group", { name: "Function" });
  await curve.getByRole("textbox", { name: "f(x) =" }).fill("a x^2");
  await add(page, "Point");
  const point = dialog.getByRole("group", { name: "Point" });
  await point.getByRole("textbox", { exact: true, name: "x" }).fill("1");
  await point.getByRole("textbox", { exact: true, name: "y" }).fill("1");
  await point.getByRole("textbox", { name: "Label" }).fill("A");
  await add(page, "Vector");
  const vector = dialog.getByRole("group", { name: "Vector" });
  await expect(vector.getByRole("textbox", { name: "x₂" })).toHaveValue("3");

  // A half-typed number marks its field and keeps the last picture until it reads again.
  await point.getByRole("textbox", { exact: true, name: "y" }).fill("1 +");
  await expect(
    point.getByRole("textbox", { exact: true, name: "y" })
  ).toHaveAttribute("aria-invalid", "true");
  await expect(save).toBeDisabled();
  await expect(preview).toBeVisible();
  await point.getByRole("textbox", { exact: true, name: "y" }).fill("1");
  await expect(save).toBeEnabled();

  // The builder fits a phone, a tablet and a desktop in light and dark, with no sideways scroll.
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const screen of SCREENS) {
      await page.setViewportSize(screen);
      // A dialog that turns into a drawer, or back, opens again: the shot waits for its plane's
      // canvas and for its opening to end.
      await expect(preview.locator("canvas").first()).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document
                .getAnimations()
                .filter((animation) => animation.playState === "running").length
          )
        )
        .toBe(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`builder-${screen.width}-${scheme}.png`),
      });
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ height: 900, width: 1440 });

  // The same objects stand in space: the point and the vector take z, and the function becomes a surface.
  const space = dialog.getByRole("switch", { name: "3D" });
  await space.click();
  await expect(space).toBeChecked();
  await expect(
    point.getByRole("textbox", { exact: true, name: "z" })
  ).toHaveValue("0");
  await expect(save).toBeEnabled();
  await expect(preview).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("builder-1440-space.png"),
  });
  await space.click();
  await expect(space).not.toBeChecked();

  await save.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-figure]")).toHaveCount(1);

  // The figure opens again in the builder with what the teacher wrote, at the range it shows.
  await page.getByRole("button", { name: "Edit figure" }).click();
  await expect(
    dialog
      .getByRole("group", { name: "Point" })
      .getByRole("textbox", { name: "Label" })
  ).toHaveValue("A");
  await expect(
    dialog.getByRole("switch", { name: "Fit the plane to the objects" })
  ).not.toBeChecked();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("link", { name: "Try as student" }).click();
  await page.waitForURL(TRY_PATH);
  await expect(
    page.getByRole("figure", { name: "Parabola dengan" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await context.close();
});
