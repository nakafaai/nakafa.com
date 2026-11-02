import { expect, type Locator, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The address of an exam's editor. */
const EXAM_EDITOR = /\/exams\/[^/]+\/edit$/u;

/** The most a row's menu may stand from its line: the cell's padding on both sides. */
const MENU_PADDING = 16;

/** The width every column's panel keeps, the gap between its parts, and what a sub-pixel may move an edge. */
const PANEL_WIDTH = 288;
const PANEL_GAP = 8;
const EDGE_SLACK = 1;

/**
 * Opens a head's panel and holds it to the rule the owner gave with photos of production: one width, every
 * part flush with the same four edges, the same gap between parts, so nothing touches, and every control
 * of one height.
 */
async function expectEvenPanel(page: Page, card: Locator, head: string) {
  await card.getByRole("button", { exact: true, name: head }).click();
  const panel = page.locator('[data-slot="popover-content"][data-open]');
  await expect(panel).toBeVisible();
  // A panel opens with a small scale, so it is measured once it stands at its own size.
  await panel.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished))
  );
  const layout = await panel.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const parts = Array.from(element.children, (part) =>
      part.getBoundingClientRect()
    );
    return {
      bottom: box.bottom - (parts.at(-1)?.bottom ?? 0),
      gaps: parts.slice(1).map((part, i) => part.top - parts[i].bottom),
      heights: Array.from(
        element.querySelectorAll('[data-slot="button-group"] button, fieldset'),
        (control) => control.getBoundingClientRect().height
      ),
      lefts: parts.map((part) => part.left - box.left),
      rights: parts.map((part) => box.right - part.right),
      top: (parts[0]?.top ?? 0) - box.top,
      width: box.width,
    };
  });
  expect(layout.width, head).toBe(PANEL_WIDTH);
  for (const gap of layout.gaps) {
    expect(gap, head).toBeCloseTo(PANEL_GAP, 0);
  }
  for (const edge of [...layout.lefts, ...layout.rights, layout.bottom]) {
    expect(Math.abs(edge - layout.top), head).toBeLessThanOrEqual(EDGE_SLACK);
  }
  expect(Arr.dedupe(layout.heights), head).toHaveLength(1);
  await page.keyboard.press("Escape");
}

/** Every column head with a name holds the button that filters it; only the row's menu has none. */
async function expectEveryHeadFilters(card: Locator) {
  const heads = await card.getByRole("columnheader").all();
  expect(heads.length).toBeGreaterThan(1);
  for (const head of heads) {
    const name = await head.textContent();
    if (name === "") {
      continue;
    }
    await expect(head.getByRole("button"), name ?? "").toHaveCount(1);
  }
}

/** The row's menu stands right beside its line, with no empty room in its cell. */
async function expectNarrowMenu(card: Locator) {
  const row = card
    .getByRole("row")
    .filter({ has: card.page().getByRole("button", { name: "More actions" }) })
    .first();
  const button = row.getByRole("button", { name: "More actions" });
  const cell = row.getByRole("cell").last();
  const [buttonBox, cellBox] = await Promise.all([
    button.boundingBox(),
    cell.boundingBox(),
  ]);
  expect((cellBox?.width ?? 0) - (buttonBox?.width ?? 0)).toBeLessThanOrEqual(
    MENU_PADDING + 1
  );
}

/** Opens a head's panel, fills one field, sees no row left, and resets the column back to its rows. */
async function expectFieldFilters(
  page: Page,
  card: Locator,
  head: string,
  field: Locator,
  value: string
) {
  const rows = await card.getByRole("row").count();
  await card.getByRole("button", { exact: true, name: head }).click();
  await field.fill(value);
  await expect(card.getByText("No results.")).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(card.getByRole("row")).toHaveCount(rows);
  await page.keyboard.press("Escape");
}

/**
 * The owner asked twice for a filter on every column, and for the row's menu as narrow as its button. The sorts of a
 * head and its filter share one panel that carries no label over the head's own words.
 */
test("every column of the School's tables filters from its head, and the row's menu is as narrow as its button", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `filters-${school.slug}@acceptance.example.test`;
  const studentContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: studentContext,
      slug: school.slug,
    })
  );
  await studentContext.close();
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  await Effect.runPromise(seedSitting(school.slug, learner, 2));
  const page = await context.newPage();
  const card = page.locator('[data-slot="table-card"]');

  await page.goto(address("/settings/members"));
  await expect(card.getByRole("row").nth(1)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expectEveryHeadFilters(card);
  await expectNarrowMenu(card);
  // A row with no action of its own draws no pointer.
  await expect(card.getByRole("row").nth(1)).not.toHaveCSS("cursor", "pointer");
  await expectFieldFilters(
    page,
    card,
    "Name",
    page.getByRole("textbox", { exact: true, name: "Name" }),
    "no such name"
  );

  await page.goto(address("/exams"));
  await expect(card.getByRole("row").nth(1)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expectEveryHeadFilters(card);
  await expectNarrowMenu(card);
  // A title cell leads with what the row is, and pressing the row opens it, as its name does.
  const exam = card.getByRole("row").nth(1);
  await expect(exam.getByRole("cell").first().locator("svg")).toBeVisible();
  await expect(exam).toHaveCSS("cursor", "pointer");
  await exam.getByRole("cell").nth(2).click();
  await expect(page).toHaveURL(EXAM_EDITOR, {
    timeout: readinessTimeoutMilliseconds,
  });
  await page.goBack();
  await expect(card.getByRole("row").nth(1)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expectFieldFilters(
    page,
    card,
    "Questions",
    page.getByRole("textbox", { name: "Questions, Minimum" }),
    "99999"
  );
  await expectEvenPanel(page, card, "Exam title");
  await expectEvenPanel(page, card, "Questions");
  await expectEvenPanel(page, card, "Created");
  await card.getByRole("button", { exact: true, name: "Created" }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(page.getByRole("button", { name: "Oldest" })).toBeVisible();
  await expect(
    page.locator(
      '[data-slot="popover-content"][data-open] [data-slot="dropdown-menu-label"]'
    )
  ).toHaveCount(0);
  await context.close();
});
