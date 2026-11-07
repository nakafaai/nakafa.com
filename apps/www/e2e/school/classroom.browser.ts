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
const WIDTHS = [1920, 1440, 768, 390, 320] as const;

/** The two themes every class tab is read in. */
const SCHEMES = ["light", "dark"] as const;

/**
 * Every tab of the class `signInClassTeacher` seeds, by its name, with the part its body stands on once
 * it has drawn: the forum's row of panes, a list's table card, or nothing the frame measures.
 */
const TABS = [
  { name: "Home", part: null },
  { name: "Forum", part: "resizable-panel-group" },
  { name: "Library", part: "table-card" },
  { name: "Tasks", part: "table-card" },
  { name: "People", part: "table-card" },
  { name: "Grades", part: "table-card" },
] as const;

/** The address of the class's home, which its sidebar entry opens. */
const CLASS_HOME_PATH = /\/classes\/fisika-x-1$/u;

/** The address of one chat of the class's forum, which names the chat in its query. */
const CHANNEL_PATH = /\/classes\/fisika-x-1\/forum\?channel=/u;

/**
 * How far the class's body reaches past its header's frame, on either side, and how far the page
 * scrolls sideways. The frame is the tab row, which stands in the header's frame with its gutter; the
 * body is each table card and the forum's row of panes. A tab's own views, such as the library's Files, Starred
 * and Trash, are tabs too, so the frame is the tab row that the class names.
 */
const overflowOf = (page: Page) =>
  page.evaluate(() => {
    const tabs = document.querySelector(
      'main [role="tablist"][aria-label="Class"]'
    );
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
    // A table card closes on the screen with its bottom border, and its table scrolls inside it, never past it.
    const cards = Array.from(
      document.querySelectorAll('main [data-slot="table-card"]'),
      (card) => {
        const box = card.getBoundingClientRect();
        const table = card
          .querySelector('[data-slot="table-container"]')
          ?.getBoundingClientRect();
        return {
          border: Number.parseFloat(getComputedStyle(card).borderBottomWidth),
          bottom: box.bottom - window.innerHeight,
          table: table === undefined ? 0 : table.right - box.right,
        };
      }
    );
    // The header holds the path, a search, and two buttons at most, none of them in a group.
    const header = document.querySelector('header[data-slot="page-header"]');
    const buttons = Array.from(
      header?.querySelectorAll('[data-slot="button"]') ?? []
    ).filter((button) => button.closest("nav") === null);
    return {
      body: Math.max(0, ...past),
      buttons: buttons.length,
      cards,
      groups:
        header?.querySelectorAll('[data-slot="button-group"]').length ?? 0,
      parts: parts.length,
      sideways:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });

test("every class tab keeps its body inside the header's frame, its table in a card that closes on the screen, two header buttons at most, and no sideways scroll, at 1920, 1440, 768, 390 and 320 px, light and dark", async ({
  baseURL,
  browser,
}, info) => {
  test.setTimeout(readinessTimeoutMilliseconds * 40);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const page = await context.newPage();
  // One hard load, then each tab by its press, as a teacher moves through the class.
  await page.goto(address("/classes/fisika-x-1"));
  const tabs = page.getByRole("tablist", { name: "Class" });
  await expect(tabs).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of WIDTHS) {
      await page.setViewportSize({ height: 900, width });
      for (const tab of TABS) {
        await tabs.getByRole("tab", { name: tab.name }).click();
        await expect(
          tabs.getByRole("tab", { name: tab.name, selected: true })
        ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
        if (tab.part !== null) {
          await expect(
            page.locator(`main [data-slot="${tab.part}"]`).first()
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
        }
        await page.screenshot({
          path: info.outputPath(
            `class-${tab.name.toLowerCase()}-${width}-${scheme}.png`
          ),
        });
        const measured = await overflowOf(page);
        const label = `${tab.name} at ${width} px in ${scheme}`;
        expect(
          {
            body: measured.body,
            groups: measured.groups,
            sideways: measured.sideways,
          },
          label
        ).toEqual({ body: 0, groups: 0, sideways: 0 });
        expect(measured.buttons, label).toBeLessThanOrEqual(2);
        for (const card of measured.cards) {
          expect(card.border, label).toBeGreaterThanOrEqual(1);
          expect(card.bottom, label).toBeLessThanOrEqual(0);
          expect(card.table, label).toBeLessThanOrEqual(0);
        }
      }
    }
  }
  await context.close();
});

test("a class's sidebar entry opens the class home and unfolds nothing, because its places are the page's tabs", async ({
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
  await page.goto(address("/notifications"));
  const sidebar = page.locator('[data-slot="sidebar"]');
  const entry = sidebar.getByRole("link", { exact: true, name: "Fisika X-1" });
  await waitUntilTakenOver(entry);
  await entry.click();
  await page.waitForURL(CLASS_HOME_PATH);
  await expect(entry).toHaveAttribute("data-active", "true");
  await expect(sidebar.locator('[data-slot="sidebar-menu-sub"]')).toHaveCount(
    0
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

test("the selects of New task open with a one-word label and an icon on every option, at 1440, 768, 390 and 320 px, light and dark", async ({
  baseURL,
  browser,
}, info) => {
  test.setTimeout(readinessTimeoutMilliseconds * 20);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const page = await context.newPage();
  await page.goto(address("/classes/fisika-x-1/tasks"));
  const create = page.getByRole("button", { name: "New task" });
  await waitUntilTakenOver(create);

  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of [1440, 768, 390, 320] as const) {
      await page.setViewportSize({ height: 900, width });
      await create.click();
      const dialog = page.getByRole("dialog");
      for (const choice of [
        { field: "Late work", label: "Lateness" },
        { field: "Questions", label: "Questions" },
        { field: "Who gets it", label: "Recipients" },
      ]) {
        await dialog.getByRole("combobox", { name: choice.field }).click();
        const list = page.getByRole("listbox");
        await expect(
          list.getByText(choice.label, { exact: true })
        ).toBeVisible();
        const options = list.getByRole("option");
        await expect(options.first()).toBeVisible();
        for (const option of await options.all()) {
          await expect(option.locator("svg").first()).toBeVisible();
        }
        await page.screenshot({
          path: info.outputPath(
            `select-${choice.label.toLowerCase()}-${width}-${scheme}.png`
          ),
        });
        await page.keyboard.press("Escape");
        await expect(list).toBeHidden();
      }
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
    }
  }
  await context.close();
});
