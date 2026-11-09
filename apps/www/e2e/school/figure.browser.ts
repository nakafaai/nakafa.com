import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The address of an exam's try as a student on the school host. */
const TRY_PATH = /\/exams\/[^/]+\/try$/u;

/** The screens a teacher builds a figure on: a phone, a tablet and a desktop. */
const SCREENS = [
  { height: 844, width: 390 },
  { height: 1024, width: 768 },
  { height: 900, width: 1440 },
] as const;

/** Adds one object or a slider from the builder's add menu. */
const add = async (page: Page, name: string) => {
  await page
    .getByRole("dialog")
    .getByRole("button", { exact: true, name: "Add" })
    .click();
  await page.getByRole("menuitem", { exact: true, name }).click();
};

test("a teacher builds a graph of a function, a slider, a labelled point and a vector, edits it, and the student reads it", async ({
  baseURL,
  browser,
}, testInfo) => {
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

  // The builder opens on a function already drawn; Save waits for a name and a text alternative.
  await page.getByRole("button", { exact: true, name: "Figure" }).click();
  await page.getByRole("menuitem", { name: "Graph" }).click();
  const dialog = page.getByRole("dialog");
  const save = dialog.getByRole("button", { name: "Save" });
  const preview = dialog.getByRole("figure");
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
  await expect(point.getByRole("textbox", { exact: true, name: "y" })).toHaveAttribute(
    "aria-invalid",
    "true"
  );
  await expect(save).toBeDisabled();
  await expect(preview).toBeVisible();
  await point.getByRole("textbox", { exact: true, name: "y" }).fill("1");
  await expect(save).toBeEnabled();

  // The builder fits a phone, a tablet and a desktop in light and dark, with no sideways scroll.
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const screen of SCREENS) {
      await page.setViewportSize(screen);
      await expect(dialog.getByRole("figure")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true);
      await testInfo.attach(`builder-${screen.width}-${scheme}`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ height: 900, width: 1440 });

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-figure]")).toHaveCount(1);

  // The figure opens again with what the teacher wrote, at the range it shows.
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
  await expect(page.getByRole("figure", { name: "Parabola dengan" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await context.close();
});
