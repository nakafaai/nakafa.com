import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { openMemoryPage } from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readPlaceholder } from "@/e2e/support/placeholder";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";
import {
  controlCard,
  listCard,
  openedPanel,
  pressTimes,
  resizerOf,
  widthOf,
} from "@/e2e/support/worst";

const WORDS = "Studies after dinner";
/** The name of the search field on the German page. */
const SEARCH_LABEL = "Erinnerung suchen";
/** The search field, a text box that the browser draws no clear control for. */
const SEARCH = `input[type="text"][role="searchbox"][aria-label="${SEARCH_LABEL}"]`;
/** The design system's clear button of the search field, in German. */
const CLEAR_LABEL = "Suche löschen";
/** The card of the list is never narrower than 20rem. */
const LIST_CARD = 320;
/** What the row keeps for the list: the card and the 1.5rem of padding on each side. */
const LIST_ROOM = 368;
const SMALLEST_PANEL = 384;
const WIDEST_PANEL = 768;
/** The width from which the editor is a panel: 65rem. */
const WIDE = 1040;
/** The line height of the small text of a card, and the lines the explanation may take on a narrow card. */
const LINE_HEIGHT = 20;
const LINES = 3;

/** The box an element takes on the page, or null when it is missing. */
type Box = Awaited<ReturnType<Locator["boundingBox"]>>;

/** The edges of a box. A missing box has zero edges, so check it exists first. */
function edgesOf(box: Box) {
  const left = box?.x ?? 0;
  const top = box?.y ?? 0;
  return {
    bottom: top + (box?.height ?? 0),
    left,
    right: left + (box?.width ?? 0),
    top,
  };
}

/** The row of the settings layout that holds the page and the panel. */
const rowOf = (page: Page) =>
  page.locator("#user-settings-panel").locator("..");

/**
 * What the page shows now: the width of the card of the list, the width the
 * panel really has, the width of the row that holds them, and how far the page
 * scrolls sideways.
 */
const geometryNow = (page: Page) =>
  Effect.promise(async () => ({
    card: await widthOf(listCard(page)),
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    ),
    panel: await widthOf(page.locator("aside")),
    row: await widthOf(rowOf(page)),
  }));

/** What the resizer says: the width of the panel, and the narrowest and the widest it can be. */
const resizerNow = (page: Page) =>
  Effect.promise(async () => {
    const resizer = resizerOf(page);

    await expect(resizer).toBeVisible();
    return {
      max: Number(await resizer.getAttribute("aria-valuemax")),
      min: Number(await resizer.getAttribute("aria-valuemin")),
      now: Number(await resizer.getAttribute("aria-valuenow")),
    };
  });

/** The widest the panel can be in a row: the row less the room the list keeps, and at most 768. */
const widestIn = (row: number) => Math.min(WIDEST_PANEL, row - LIST_ROOM);

/**
 * The panel is dragged to its widest with the keyboard and then to its
 * narrowest. The list keeps a card of 20rem at every width, the resizer says
 * the width the panel has and the widest and narrowest it can have, and the
 * page never scrolls sideways.
 */
const verifyRoom = Effect.fn("NakafaE2E.verifyRoom")(function* (
  page: Page,
  baseURL: string
) {
  yield* openedPanel(page, baseURL, WORDS);
  const start = yield* geometryNow(page);

  // The list keeps its card beside the panel as it opens, at its default width.
  expect(start.card).toBeGreaterThanOrEqual(LIST_CARD);
  const opening = yield* resizerNow(page);

  expect(opening.min).toBe(SMALLEST_PANEL);
  expect(opening.now).toBe(Math.round(start.panel));

  yield* Effect.promise(() => resizerOf(page).focus());
  yield* pressTimes(page, "ArrowLeft", 40);
  const widest = yield* geometryNow(page);
  const widestSaid = yield* resizerNow(page);

  expect(widest.card).toBeGreaterThanOrEqual(LIST_CARD);
  expect(widest.overflow).toBeLessThanOrEqual(0);
  expect(widestSaid.max).toBeCloseTo(widestIn(widest.row), 0);
  expect(widestSaid.now).toBe(widestSaid.max);
  expect(widest.panel).toBeCloseTo(widestSaid.max, 0);

  yield* pressTimes(page, "ArrowRight", 60);
  const narrowest = yield* geometryNow(page);
  const narrowestSaid = yield* resizerNow(page);

  expect(narrowestSaid.now).toBe(SMALLEST_PANEL);
  expect(narrowest.panel).toBeCloseTo(SMALLEST_PANEL, 0);
  expect(narrowestSaid.max).toBe(widestSaid.max);
});

for (const viewport of [
  { height: 768, width: WIDE },
  { height: 800, width: 1280 },
  { height: 900, width: 1440 },
]) {
  test.describe(`Memory panel at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("never takes the room the list needs, and its resizer says its width", async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.fromNullishOr(baseURL).pipe(
            Effect.flatMap((origin) => verifyRoom(page, origin))
          )
        )
      );
    });
  });
}

/**
 * The window narrows while the panel is at its widest: the panel gives way to
 * the room the list keeps, its resizer says the width it has, and the width the
 * learner chose comes back when the window widens again.
 */
const verifyWindowChange = Effect.fn("NakafaE2E.verifyWindowChange")(function* (
  page: Page,
  baseURL: string
) {
  yield* openedPanel(page, baseURL, WORDS);
  yield* Effect.promise(async () => {
    await expect(resizerOf(page)).toBeVisible();
    await resizerOf(page).focus();
  });
  yield* pressTimes(page, "ArrowLeft", 60);
  expect((yield* resizerNow(page)).now).toBe(WIDEST_PANEL);

  yield* Effect.promise(() =>
    page.setViewportSize({ height: 800, width: 1100 })
  );
  // The window left less room, so the panel has less width, and says so.
  yield* Effect.promise(() =>
    expect(resizerOf(page)).not.toHaveAttribute(
      "aria-valuenow",
      `${WIDEST_PANEL}`
    )
  );
  const narrow = yield* geometryNow(page);
  const narrowSaid = yield* resizerNow(page);

  expect(narrow.card).toBeGreaterThanOrEqual(LIST_CARD);
  expect(narrowSaid.now).toBe(Math.round(narrow.panel));
  expect(narrowSaid.now).toBeCloseTo(widestIn(narrow.row), 0);

  yield* Effect.promise(() =>
    page.setViewportSize({ height: 900, width: 1440 })
  );
  // The width the learner chose comes back with the room.
  yield* Effect.promise(() =>
    expect(resizerOf(page)).toHaveAttribute("aria-valuenow", `${WIDEST_PANEL}`)
  );
  expect(Math.round((yield* geometryNow(page)).panel)).toBe(WIDEST_PANEL);
});

test.describe("Memory panel when the window changes", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("gives way to the list and takes back the width it was given", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyWindowChange(page, origin))
        )
      )
    );
  });
});

/**
 * Below 65rem the list cannot keep its room beside the smallest panel once the
 * sidebar and the gutters of a classic scrollbar have taken theirs, so the
 * editor is the sheet it is on a phone. From 65rem it is a panel and the list
 * keeps its card.
 */
const verifyBreakpoint = Effect.fn("NakafaE2E.verifyBreakpoint")(function* (
  page: Page,
  baseURL: string
) {
  yield* openedPanel(page, baseURL, WORDS);
  yield* Effect.promise(async () => {
    await expect(page.locator("aside")).toBeVisible();
    await page.setViewportSize({ height: 800, width: WIDE - 1 });
    await expect(page.locator("aside")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Memory text" })).toHaveText(
      WORDS
    );
  });
});

test.describe("Memory editor at the width where it changes layout", () => {
  test.use({ viewport: { height: 800, width: WIDE } });

  test("is a sheet one pixel below 65rem", async ({ baseURL, page }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyBreakpoint(page, origin))
        )
      )
    );
  });
});

/**
 * What the German page shows where the card is narrow: the placeholder of the
 * search is whole, the search keeps no slot for a clear button while it is
 * empty and gives one back with the first letter, and the button that adds a
 * memory is beside it inside the card. The explanation and the button of the
 * card that deletes every memory share one row, so that the button stays in the
 * card beside the text, and the text keeps lines of a readable length.
 */
const verifyNarrowCards = Effect.fn("NakafaE2E.verifyNarrowCards")(function* (
  page: Page,
  baseURL: string
) {
  yield* openMemoryPage(page, baseURL);
  const search = page.getByRole("searchbox", { name: SEARCH_LABEL });

  yield* Effect.promise(async () => {
    await page.goto("/de/user/settings/memory");
    await expect(search).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    // Next to the editor's panel the card is as narrow as the page lets it be.
    if ((page.viewportSize()?.width ?? 0) >= WIDE) {
      const add = page.getByRole("button", { name: "Erinnerung hinzufügen" });
      await waitUntilTakenOver(add);
      await add.click();
      await expect(page.locator("aside")).toBeVisible();
    }
  });
  const placeholder = yield* readPlaceholder(page, SEARCH);

  yield* Effect.promise(async () => {
    const card = await controlCard(page).boundingBox();
    const button = await controlCard(page)
      .getByRole("button", { exact: true, name: "Alle löschen" })
      .boundingBox();
    const explanation = await controlCard(page)
      .locator("p", { hasText: "Erinnerungen bleiben" })
      .boundingBox();
    const list = await listCard(page).boundingBox();
    const field = await search.boundingBox();
    const add = await listCard(page)
      .getByRole("button", { name: "Erinnerung hinzufügen" })
      .boundingBox();

    // The field is empty, so it shows no clear button and the placeholder has
    // the whole of the field, and its text is not cut.
    expect(placeholder.room).toBeGreaterThan(0);
    await expect(
      listCard(page).getByRole("button", { name: CLEAR_LABEL })
    ).toHaveCount(0);
    expect(
      placeholder.overflow,
      `the card is ${card?.width}px wide and the field gives the placeholder ${placeholder.room}px`
    ).toBe(0);
    // The button that adds a memory is beside the field, inside the card.
    expect(add).not.toBeNull();
    expect(field).not.toBeNull();
    expect(list).not.toBeNull();
    expect(edgesOf(field).right).toBeLessThanOrEqual(edgesOf(add).left);
    expect(edgesOf(add).right).toBeLessThanOrEqual(edgesOf(list).right);
    // The button is inside its card, on the same row as the text and to its right.
    expect(card).not.toBeNull();
    expect(button).not.toBeNull();
    expect(explanation).not.toBeNull();
    expect(edgesOf(button).right).toBeLessThanOrEqual(edgesOf(card).right);
    expect(explanation?.height ?? 0).toBeLessThanOrEqual(LINES * LINE_HEIGHT);
    expect(edgesOf(explanation).right).toBeLessThanOrEqual(
      edgesOf(button).left
    );
    expect(edgesOf(button).top).toBeLessThan(edgesOf(explanation).bottom);
    expect(edgesOf(explanation).top).toBeLessThan(edgesOf(button).bottom);
  });

  // The first letter brings the design system's clear button, and pressing it
  // empties the field and keeps the focus there.
  yield* Effect.promise(async () => {
    await search.fill("a");
    const clear = listCard(page).getByRole("button", { name: CLEAR_LABEL });
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(search).toHaveValue("");
    await expect(search).toBeFocused();
  });
});

for (const viewport of [
  { height: 640, width: 320 },
  { height: 768, width: WIDE },
  { height: 800, width: 1280 },
]) {
  test.describe(`German cards at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("show the whole search placeholder and keep the button in its card", async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.fromNullishOr(baseURL).pipe(
            Effect.flatMap((origin) => verifyNarrowCards(page, origin))
          )
        )
      );
    });
  });
}
