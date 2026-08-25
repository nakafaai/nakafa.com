import { expect, type Locator, type Page } from "@playwright/test";
import type { Contributor } from "@repo/contents/_types/contributor";
import { Effect, Schema } from "effect";
import { dragTouch } from "./touch";

const COARSE_SPLITTER_TARGET_WIDTH = 44;
const FINE_SPLITTER_TARGET_WIDTH = 24;

export const legacyAvatarFragmentIds = [
  "clip0",
  "mask-id",
  "mouth-laugh-id",
  "path-id",
] as const;

const MarketingSurfaceSchema = Schema.Literals([
  "contributor-drawer",
  "community",
  "primary-pane",
  "source-pane",
  "splitter",
  "trust",
]);

/** The fixed contributor fixture does not contain its required first row. */
export class MarketingContributorMissing extends Schema.TaggedError<MarketingContributorMissing>()(
  "MarketingContributorMissing",
  {}
) {
  get message() {
    return "The marketing contributor fixture is empty.";
  }
}

/** One interactive marketing surface did not expose measurable bounds. */
export class MarketingBoundsMissing extends Schema.TaggedError<MarketingBoundsMissing>()(
  "MarketingBoundsMissing",
  { surface: MarketingSurfaceSchema }
) {
  get message() {
    return `Marketing surface bounds are missing: surface=${this.surface}.`;
  }
}

/** One required homepage surface was absent from the rendered document. */
export class MarketingSurfaceMissing extends Schema.TaggedError<MarketingSurfaceMissing>()(
  "MarketingSurfaceMissing",
  { surface: MarketingSurfaceSchema }
) {
  get message() {
    return `Marketing surface is missing: surface=${this.surface}.`;
  }
}

/** Reads the required first contributor without inventing fixture data. */
export const readFirstContributor = Effect.fn(
  "NakafaE2E.readFirstMarketingContributor"
)(function* (values: readonly Contributor[]) {
  const contributor = values[0];
  if (!contributor) {
    return yield* new MarketingContributorMissing({});
  }
  return contributor;
});

/** Reads the structural budgets and ID integrity of the rendered homepage. */
export const measureMarketingPage = Effect.fn("NakafaE2E.measureMarketingPage")(
  function* (page: Page) {
    const measurements = yield* Effect.promise(() =>
      page.evaluate((legacyIds) => {
        const knownAvatarFragmentIds = new Set<string>(legacyIds);
        const community = document.querySelector("#community");
        const trust = document.querySelector("#trust");
        const ids = [...document.querySelectorAll("[id]")].map(({ id }) => id);
        const duplicateIds = [
          ...new Set(ids.filter((id, index) => ids.indexOf(id) !== index)),
        ];
        const unexpectedDuplicateIds = duplicateIds.filter((id) => {
          if (!knownAvatarFragmentIds.has(id)) {
            return true;
          }

          const matchingElements = [
            ...document.querySelectorAll(`[id="${CSS.escape(id)}"]`),
          ];
          return matchingElements.some(
            (element) =>
              !element.closest("#community [data-contributor-gallery] svg")
          );
        });
        const fragmentReferences = [
          ...document.querySelectorAll("[clip-path], [mask]"),
        ].flatMap((element) => {
          const values = [
            element.getAttribute("clip-path"),
            element.getAttribute("mask"),
          ];
          return values.flatMap((value) =>
            value?.startsWith("url(#") ? [value.slice(5, -1)] : []
          );
        });

        return {
          communityChromeDescendants: community
            ? community.querySelectorAll(":scope *:not(svg *)").length
            : -1,
          communityDescendants: community
            ? community.querySelectorAll("*").length
            : -1,
          communityHtmlBytes: community
            ? new TextEncoder().encode(community.outerHTML).byteLength
            : -1,
          communityPresent: community !== null,
          homepageDescendants: document.body.querySelectorAll("*").length,
          legacyAvatarDuplicateIds: duplicateIds
            .filter((id) => knownAvatarFragmentIds.has(id))
            .sort(),
          missingFragmentReferences: [
            ...new Set(
              fragmentReferences.filter(
                (fragmentId) => !document.getElementById(fragmentId)
              )
            ),
          ],
          trustDescendants: trust ? trust.querySelectorAll("*").length : -1,
          trustPresent: trust !== null,
          unexpectedDuplicateIds: unexpectedDuplicateIds.sort(),
        };
      }, legacyAvatarFragmentIds)
    );

    if (!measurements.communityPresent) {
      return yield* new MarketingSurfaceMissing({ surface: "community" });
    }
    if (!measurements.trustPresent) {
      return yield* new MarketingSurfaceMissing({ surface: "trust" });
    }
    return measurements;
  }
);

const readBounds = Effect.fn("NakafaE2E.readMarketingBounds")(function* (
  locator: Locator,
  surface: Schema.Schema.Type<typeof MarketingSurfaceSchema>
) {
  const bounds = yield* Effect.promise(() => locator.boundingBox());
  if (!bounds) {
    return yield* new MarketingBoundsMissing({ surface });
  }
  return bounds;
});

/** Proves the desktop splitter's semantics, constraints, and input methods. */
export const verifyDesktopSplitter = Effect.fn(
  "NakafaE2E.verifyDesktopSplitter"
)(function* (
  primaryPane: Locator,
  sourcePane: Locator,
  splitter: Locator,
  page: Page,
  resizeLabel: string
) {
  yield* Effect.promise(() => expect(splitter).toBeVisible());
  yield* Effect.promise(() =>
    expect(splitter).toHaveAttribute("role", "separator")
  );
  yield* Effect.promise(() =>
    expect(splitter).toHaveAccessibleName(resizeLabel)
  );
  yield* Effect.promise(() =>
    expect(splitter).toHaveAttribute("aria-controls", "trust-primary-pane")
  );
  yield* Effect.promise(() =>
    expect(splitter).toHaveAttribute("aria-orientation", "vertical")
  );
  yield* Effect.promise(() =>
    expect(splitter).toHaveAttribute("aria-valuemin", "36")
  );
  yield* Effect.promise(() =>
    expect(splitter).toHaveAttribute("aria-valuemax", "64")
  );
  yield* Effect.promise(() =>
    expect(splitter).toHaveAttribute("aria-valuenow", "50")
  );

  const [primaryBounds, sourceBounds] = yield* Effect.all([
    readBounds(primaryPane, "primary-pane"),
    readBounds(sourcePane, "source-pane"),
  ]);
  yield* Effect.sync(() => {
    expect(Math.abs(primaryBounds.y - sourceBounds.y)).toBeLessThan(2);
    expect(sourceBounds.x).toBeGreaterThan(primaryBounds.x);
  });

  yield* Effect.promise(() => splitter.focus());
  yield* Effect.promise(() => page.keyboard.press("ArrowRight"));
  yield* Effect.promise(() =>
    expect(splitter).toHaveAttribute("aria-valuenow", "51")
  );
  yield* Effect.promise(() => page.keyboard.press("Home"));
  yield* Effect.promise(() =>
    expect(splitter).toHaveAttribute("aria-valuenow", "36")
  );
  yield* Effect.promise(() => page.keyboard.press("End"));
  yield* Effect.promise(() =>
    expect(splitter).toHaveAttribute("aria-valuenow", "64")
  );
  yield* Effect.promise(() => page.keyboard.press("Home"));

  const splitterBounds = yield* readBounds(splitter, "splitter");
  const usesCoarsePointer = yield* Effect.promise(() =>
    page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)
  );
  const minimumTargetWidth = usesCoarsePointer
    ? COARSE_SPLITTER_TARGET_WIDTH
    : FINE_SPLITTER_TARGET_WIDTH;
  yield* Effect.sync(() =>
    expect(splitterBounds.width).toBeGreaterThanOrEqual(minimumTargetWidth)
  );
  const centerX = splitterBounds.x + splitterBounds.width / 2;
  const centerY = splitterBounds.y + splitterBounds.height / 2;
  yield* Effect.promise(() => page.mouse.move(centerX, centerY));
  yield* Effect.promise(() => page.mouse.down());
  yield* Effect.promise(() => page.mouse.move(centerX + 600, centerY));
  yield* Effect.promise(() => page.mouse.up());
  yield* Effect.promise(() =>
    expect
      .poll(() =>
        splitter.getAttribute("aria-valuenow").then((value) => Number(value))
      )
      .toBeGreaterThan(36)
  );

  yield* Effect.promise(() => page.keyboard.press("Home"));
  yield* dragTouch(
    page,
    { x: centerX, y: centerY },
    { x: centerX + 200, y: centerY }
  );
  yield* Effect.promise(() =>
    expect
      .poll(() =>
        splitter.getAttribute("aria-valuenow").then((value) => Number(value))
      )
      .toBeGreaterThan(36)
  );
  yield* Effect.promise(() =>
    expect
      .poll(() =>
        splitter.getAttribute("aria-valuenow").then((value) => Number(value))
      )
      .toBeLessThanOrEqual(64)
  );
});

/** Dismisses the active contributor drawer through a real touch gesture. */
export const swipeContributorDrawer = Effect.fn(
  "NakafaE2E.swipeContributorDrawer"
)(function* (drawer: Locator, page: Page) {
  const bounds = yield* readBounds(drawer, "contributor-drawer");
  const start = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + 20,
  };
  yield* dragTouch(page, start, {
    x: start.x,
    y: Math.min(start.y + 320, bounds.y + bounds.height - 4),
  });
});
