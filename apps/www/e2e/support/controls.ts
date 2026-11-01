import { expect, type Page } from "@playwright/test";
import { Array as Arr, Effect } from "effect";

/**
 * The owner's rule (31 Oct): in a group means really joined, in one frame, or else a clear gap. Reads every header
 * and returns what breaks it. In a group the first control rounds its start, the last rounds its end, those between
 * stand square, and neighbours touch on one border. A wrapper in a group is read through the control it shows. A
 * control outside a group keeps a clear gap from its neighbour on the same row, and the path's own links do not count.
 */
export function readControlProblems(page: Page) {
  return page.evaluate(() => {
    // The least room, in pixels, between two controls that stand apart.
    const controlGap = 8;
    const seen = (node: Element) => {
      const box = node.getBoundingClientRect();
      return (
        box.width > 1 &&
        box.height > 1 &&
        getComputedStyle(node).visibility !== "hidden"
      );
    };
    const named = (node: Element) =>
      [
        node.getAttribute("aria-label"),
        node.textContent?.trim().slice(0, 24),
        node.getAttribute("data-slot"),
      ].find((name) => name !== null && name !== "") ?? node.tagName;
    const face = (part: Element) =>
      part.hasAttribute("data-slot")
        ? part
        : (Array.from(part.children).find(seen) ?? part);
    const rounded = (first: string, second: string) =>
      Number.parseFloat(first) > 1 && Number.parseFloat(second) > 1;

    const groupProblems = (group: Element) => {
      const faces = Array.from(group.children).filter(seen).map(face);
      const shapes = faces.flatMap((node, index) => {
        const style = getComputedStyle(node);
        const start = rounded(
          style.borderTopLeftRadius,
          style.borderBottomLeftRadius
        );
        const end = rounded(
          style.borderTopRightRadius,
          style.borderBottomRightRadius
        );
        const wantsStart = index === 0;
        const wantsEnd = index === faces.length - 1;
        return start === wantsStart && end === wantsEnd
          ? []
          : [
              `${named(node)}: start ${start ? "round" : "square"}, end ${end ? "round" : "square"}, part ${index + 1} of ${faces.length}`,
            ];
      });
      const joints = faces.slice(1).flatMap((node, index) => {
        const before = faces[index];
        if (before === undefined) {
          return [];
        }
        const gap =
          node.getBoundingClientRect().left -
          before.getBoundingClientRect().right;
        const doubled =
          gap >= 0 &&
          Number.parseFloat(getComputedStyle(before).borderRightWidth) > 0 &&
          Number.parseFloat(getComputedStyle(node).borderLeftWidth) > 0;
        return gap > 0.5 || gap < -1.5 || doubled
          ? [
              `${named(before)} and ${named(node)}: gap ${gap}, doubled ${doubled}`,
            ]
          : [];
      });
      return [...shapes, ...joints];
    };

    const headerProblems = (header: Element) => {
      const groups = Array.from(
        header.querySelectorAll('[data-slot="button-group"]')
      )
        .filter(seen)
        .filter(
          (group) =>
            group.querySelector(':scope > [data-slot="button-group"]') === null
        );
      const lone = Array.from(
        header.querySelectorAll(
          'button, a[data-slot="button"], [data-slot="input-group"], [data-slot="select-trigger"]'
        )
      )
        .filter(seen)
        .filter(
          (node) =>
            node.closest('nav, [data-slot="button-group"]') === null &&
            node.parentElement?.closest('button, [data-slot="input-group"]') ===
              null
        );
      const row = [...groups, ...lone].sort(
        (one, other) =>
          one.getBoundingClientRect().left - other.getBoundingClientRect().left
      );
      const gaps = row.slice(1).flatMap((node, index) => {
        const before = row[index];
        if (before === undefined) {
          return [];
        }
        const left = before.getBoundingClientRect();
        const right = node.getBoundingClientRect();
        const sameRow = right.top < left.bottom && left.top < right.bottom;
        const gap = right.left - left.right;
        return sameRow && gap < controlGap - 0.5
          ? [`${named(before)} and ${named(node)} stand ${gap} px apart`]
          : [];
      });
      return [...groups.flatMap(groupProblems), ...gaps];
    };

    return Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-slot="page-header"], [data-slot="pane-header"], [data-slot="app-header"]'
      )
    )
      .filter(seen)
      .flatMap(headerProblems);
  });
}

/** The four radii of every part of every group on the page, group by group, in reading order. */
function readPartRadii(page: Page) {
  return page.evaluate(() => {
    const seen = (node: Element) => {
      const box = node.getBoundingClientRect();
      return box.width > 1 && box.height > 1;
    };
    return Array.from(document.querySelectorAll('[data-slot="button-group"]'))
      .filter(seen)
      .map((group) =>
        Array.from(group.children)
          .filter(seen)
          .map((part) => {
            const shown = part.hasAttribute("data-slot")
              ? part
              : (Array.from(part.children).find(seen) ?? part);
            const style = getComputedStyle(shown);
            return [
              style.borderTopLeftRadius,
              style.borderTopRightRadius,
              style.borderBottomRightRadius,
              style.borderBottomLeftRadius,
            ].join(" ");
          })
      );
  });
}

/** The controls that a press reaches inside a group, its disabled ones left out. */
const GROUP_CONTROLS =
  '[data-slot="button-group"] :is(button, a[data-slot="button"]):not([disabled], [inert]):visible';

/** What a control opens, which says so on the page: a control's own attributes can belong to its tooltip. */
const OPEN_OVERLAY =
  '[role="menu"]:visible, [role="dialog"]:visible, [data-slot="popover-content"]:visible';

/**
 * The owner's rule (31 Oct): a control never changes shape on any state. Takes one control of a group through hover,
 * focus and press, and through its open menu or popover where it has one, and holds every part of every group to the
 * shape it had at rest. A press moves off the control before it lets go, so it never activates it.
 */
const expectControlKeepsShape = Effect.fn("NakafaE2E.expectControlKeepsShape")(
  function* (page: Page, label: string, index: number, rest: unknown) {
    const control = page.locator(GROUP_CONTROLS).nth(index);
    const held = (state: string) =>
      Effect.promise(async () => {
        expect(
          await readPartRadii(page),
          `${label}: control ${index + 1} changed a part's shape on ${state}`
        ).toEqual(rest);
      });

    yield* Effect.promise(() => control.scrollIntoViewIfNeeded());
    yield* Effect.promise(() => control.hover());
    yield* held("hover");
    yield* Effect.promise(() => control.focus());
    yield* held("focus");
    const box = yield* Effect.promise(() => control.boundingBox());
    const opens = yield* Effect.promise(() =>
      control.getAttribute("aria-haspopup")
    );
    if (box === null) {
      return;
    }
    yield* Effect.promise(async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    });
    yield* held("press");
    // A menu opens on the press, and a release on its trigger after a held press closes it, so the press ends away from
    // the control with Escape, and the open state comes from the keyboard.
    yield* Effect.promise(async () => {
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await page.keyboard.press("Escape");
      await expect(page.locator(OPEN_OVERLAY)).toHaveCount(0);
    });
    if (opens === null) {
      return;
    }
    // A key pressed while the last popup still closes is lost, so the press repeats until it opens.
    yield* Effect.promise(() =>
      expect(async () => {
        await control.focus();
        await page.keyboard.press("Enter");
        await expect(page.locator(OPEN_OVERLAY).first()).toBeVisible({
          timeout: 500,
        });
      }).toPass()
    );
    yield* held("open");
    yield* Effect.promise(async () => {
      await page.keyboard.press("Escape");
      await expect(page.locator(OPEN_OVERLAY)).toHaveCount(0);
    });
    yield* held("close");
  }
);

/** Takes every group's controls through every state, in the light theme and the dark one. */
export const expectGroupsKeepShape = Effect.fn(
  "NakafaE2E.expectGroupsKeepShape"
)(function* (page: Page, label: string) {
  yield* Effect.forEach(
    ["light", "dark"] as const,
    (colorScheme) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => page.emulateMedia({ colorScheme }));
        const rest = yield* Effect.promise(() => readPartRadii(page));
        const count = yield* Effect.promise(() =>
          page.locator(GROUP_CONTROLS).count()
        );
        yield* Effect.forEach(
          Arr.range(0, count - 1),
          (index) =>
            count === 0
              ? Effect.void
              : expectControlKeepsShape(
                  page,
                  `${label} in ${colorScheme}`,
                  index,
                  rest
                ),
          { discard: true }
        );
      }),
    { discard: true }
  );
  yield* Effect.promise(() => page.emulateMedia({ colorScheme: "light" }));
});
