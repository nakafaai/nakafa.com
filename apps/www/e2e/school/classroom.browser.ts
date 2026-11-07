import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The widths every class tab is read at: a wide monitor, a laptop, a tablet, and two phones. */
const WIDTHS = [1920, 1440, 1024, 390, 320] as const;

/** Every tab of the class `signInClassTeacher` seeds, by its address under the class. */
const TABS = [
  "",
  "/forum",
  "/library",
  "/tasks",
  "/people",
  "/grades",
] as const;

/** The address of the class's tasks. */
const TASKS_PATH = /\/classes\/fisika-x-1\/tasks$/u;

/** The address of the general chat of the class's forum. */
const CHANNEL_PATH = /\/classes\/fisika-x-1\/forum\/[^/]+$/u;

/**
 * How far the class's body reaches past its header's frame, on either side, and how far the page
 * scrolls sideways. The frame is the tab row, which stands in the header's frame with its gutter; the
 * body is each table card and the forum's row of panes.
 */
const overflowOf = (page: Page) =>
  page.evaluate(() => {
    const tabs = document.querySelector('main [role="tablist"]');
    const frame = tabs?.getBoundingClientRect();
    const parts = Array.from(
      document.querySelectorAll(
        'main [data-slot="table-card"], main [data-slot="resizable-panel-group"]'
      ),
      (part) => part.getBoundingClientRect()
    ).filter((box) => box.width > 0);
    const past = parts.map((box) =>
      Math.max((frame?.left ?? 0) - box.left, box.right - (frame?.right ?? 0))
    );
    return {
      body: Math.max(0, ...past),
      parts: parts.length,
      sideways:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });

test("every class tab keeps its body inside the header's frame, and no page scrolls sideways, at 1920, 1440, 1024, 390 and 320 px", async ({
  baseURL,
  browser,
}, info) => {
  test.setTimeout(readinessTimeoutMilliseconds * 12);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const page = await context.newPage();

  for (const width of WIDTHS) {
    await page.setViewportSize({ height: 900, width });
    for (const tab of TABS) {
      await page.goto(address(`/classes/fisika-x-1${tab}`));
      await expect(
        page.getByRole("navigation", { name: "breadcrumb" })
      ).toContainText("Fisika X-1", { timeout: readinessTimeoutMilliseconds });
      await expect(page.getByRole("tablist", { name: "Class" })).toBeVisible();
      await page.screenshot({
        path: info.outputPath(
          `class${tab.replace("/", "-") || "-home"}-${width}.png`
        ),
      });
      const measured = await overflowOf(page);
      expect(
        { body: measured.body, sideways: measured.sideways, tab, width },
        `${tab || "home"} at ${width} px`
      ).toEqual({ body: 0, sideways: 0, tab, width });
    }
  }
  await context.close();
});

test("the open class shows its forum, library, tasks and the school's pages for its cohort under its sidebar entry", async ({
  baseURL,
  browser,
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
  await page.goto(address("/classes/fisika-x-1"));
  const sidebar = page.locator('[data-slot="sidebar"]');
  const places = sidebar.locator('[data-slot="sidebar-menu-sub"]');
  await expect(places.getByRole("link", { name: "Forum" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(places.getByRole("link", { name: "Library" })).toBeVisible();
  await expect(places.getByRole("link", { name: "Tasks" })).toBeVisible();
  await expect(places.getByRole("link", { name: "Exams" })).toBeVisible();

  // A press on Tasks opens the class's tasks, and its entry is the current page.
  await places.getByRole("link", { name: "Tasks" }).click();
  await page.waitForURL(TASKS_PATH);
  await expect(places.getByRole("link", { name: "Tasks" })).toHaveAttribute(
    "data-active",
    "true"
  );
  await context.close();
});

test("the school's Owner writes in a class's forum and adds to its library, as a subject teacher does", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  // The class teacher's sign-in seeds the class Fisika X-1, which the Owner neither teaches nor attends.
  const seed = await browser.newContext();
  await Effect.runPromise(signInClassTeacher(seed, school.slug, address("/")));
  await seed.close();
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/classes/fisika-x-1/forum"));
  const general = page.getByRole("link", { exact: true, name: "General" });
  await waitUntilTakenOver(general);
  await general.click();
  await page.waitForURL(CHANNEL_PATH);
  const field = page.getByRole("textbox", { name: "Write a message" });
  await waitUntilTakenOver(field);
  await field.fill("Selamat pagi, kelas Fisika.");
  await field.press("Enter");
  await expect(
    page.getByTestId("forum-list").getByText("Selamat pagi, kelas Fisika.")
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  await page.goto(address("/classes/fisika-x-1/library"));
  await expect(
    page.getByRole("button", { name: "Add to library" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await page.goto(address("/classes/fisika-x-1/tasks"));
  await expect(page.getByRole("button", { name: "New task" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await context.close();
});
