import { expect, type Locator, type Page } from "@playwright/test";
import { Effect } from "effect";

const INTER_FONT = /Inter/u;

/**
 * Checks the title a reader sees on a reading page, in the type the design gives
 * it. A lesson opens with its reading title over the content. An article's path
 * in its header ends at its title, shown on one line, and its heading stands for
 * assistive technology only (#2239).
 */
export const expectReadingTitle = Effect.fn("NakafaE2E.expectReadingTitle")(
  function* (page: Page, title: Locator, lesson: boolean) {
    const shown = lesson
      ? title
      : page
          .locator('main [data-slot="page-header"]')
          .getByRole("navigation", { name: "breadcrumb" })
          .locator('[aria-current="page"]:visible');
    yield* Effect.promise(async () =>
      expect(shown).toHaveText((await title.textContent()) ?? "")
    );
    yield* Effect.promise(() =>
      expect(shown).toHaveCSS("font-family", INTER_FONT)
    );
    const look = yield* Effect.promise(() =>
      shown.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          align: style.textAlign,
          overflow: style.textOverflow,
          size: style.fontSize,
          space: style.whiteSpace,
          wrap: style.textWrapStyle,
        };
      })
    );
    yield* Effect.sync(() =>
      expect(look).toMatchObject(
        lesson
          ? { align: "start", size: "36px", wrap: "balance" }
          : { overflow: "ellipsis", size: "14px", space: "nowrap" }
      )
    );
    if (!lesson) {
      const titleWidth = yield* Effect.promise(() =>
        title.evaluate((element) => element.getBoundingClientRect().width)
      );
      yield* Effect.sync(() => expect(titleWidth).toBeLessThanOrEqual(1));
    }
  }
);
