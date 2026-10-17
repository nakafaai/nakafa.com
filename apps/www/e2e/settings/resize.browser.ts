import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openedPanel, resizerOf } from "@/e2e/support/worst";

const WORDS = "Studies after dinner";
/** Where the pointer lets go of the edge, in pixels from the left of the window. */
const POINTER = 760;

// The page has a scrollbar that takes room, as the pages of Windows and Linux
// do. On this page the root scroller shows one only when the page overflows the
// window, so verifyDrag asks for it.
test.use({
  launchOptions: {
    args: ["--disable-features=OverlayScrollbar"],
    ignoreDefaultArgs: ["--hide-scrollbars"],
  },
  viewport: { height: 500, width: 1280 },
});

/**
 * The learner drags the edge of the panel with the mouse. The panel ends where
 * the page ends, so its edge lands where the pointer is, and not the width of
 * the scrollbar away from it.
 */
const verifyDrag = Effect.fn("NakafaE2E.verifyDrag")(function* (
  page: Page,
  baseURL: string
) {
  yield* openedPanel(page, baseURL, WORDS);
  // At this height the Memory page showed no scrollbar of its own, because its
  // footer now holds one row and the card is shorter. The scrollbar is set here,
  // so the drag still runs beside one, which is what this test proves.
  yield* Effect.promise(() =>
    page.addStyleTag({ content: "html { overflow-y: scroll; }" })
  );
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
