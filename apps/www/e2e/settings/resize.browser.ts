import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { live } from "../support/changes";
import { EMPTY, memoryRow, opened, openMemoryPage } from "../support/memory";
import { withObservedPageErrors } from "../support/observe";
import { readinessTimeoutMilliseconds } from "../support/timeout";
import { resizerOf, writeWorst } from "../support/worst";

const WORDS = "Studies after dinner";
/** Where the pointer lets go of the edge, in pixels from the left of the window. */
const POINTER = 760;

// The page has a scrollbar that takes room, as the pages of Windows and Linux
// do. The root scroller shows one only when the page overflows the window, so
// verifyDrag writes memories until the page overflows.
test.use({
  launchOptions: {
    args: ["--disable-features=OverlayScrollbar"],
    ignoreDefaultArgs: ["--hide-scrollbars"],
  },
  viewport: { height: 500, width: 1280 },
});

/** Whether the page is taller than the window, so its root scroller shows a scrollbar. */
const pageOverflows = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollHeight >
      document.documentElement.clientHeight
  );

/**
 * The learner drags the edge of the panel with the mouse. The panel ends where
 * the page ends, so its edge lands where the pointer is, and not the width of
 * the scrollbar away from it.
 */
const verifyDrag = Effect.fn("NakafaE2E.verifyDrag")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);
  yield* Effect.promise(() =>
    expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* Effect.promise(() => live(changes));

  // The memory that the panel opens is written first. The empty state is taller
  // than one row, so more memories are written after it until the list makes the
  // page taller than the window; the open panel only narrows the list, which
  // keeps the page at least that tall.
  yield* writeWorst(page, changes, { text: WORDS });
  let written = 0;
  while (!(yield* Effect.promise(() => pageOverflows(page)))) {
    written += 1;
    yield* writeWorst(page, changes, { text: `Memory ${written}` });
  }
  yield* Effect.promise(async () => {
    await memoryRow(page, WORDS).getByText(WORDS).click();
    await opened(page, WORDS);
  });

  const scrollbar = yield* Effect.promise(() =>
    page.evaluate(
      () => window.innerWidth - document.documentElement.clientWidth
    )
  );
  const edge = yield* Effect.promise(() => resizerOf(page).boundingBox());

  // A page with no scrollbar of its own would prove nothing.
  expect(scrollbar).toBeGreaterThan(0);
  expect(edge).not.toBeNull();
  yield* Effect.promise(async () => {
    const y = (edge?.y ?? 0) + 200;

    await page.mouse.move((edge?.x ?? 0) + (edge?.width ?? 0) / 2, y);
    await page.mouse.down();
    await page.mouse.move(POINTER, y, { steps: 10 });
    await page.mouse.up();
  });
  expect(
    (yield* Effect.promise(() => page.locator("aside").boundingBox()))?.x
  ).toBe(POINTER);
});

test.describe("Memory panel dragged beside a scrollbar that takes room", () => {
  test("lands its edge under the pointer", async ({ baseURL, page }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyDrag(page, origin))
        )
      )
    );
  });
});
