import type { Locator, Page } from "@playwright/test";
import type { Contributor } from "@repo/contents/contributor";
import { Effect, Schema } from "effect";
import { readBounds, swipeDown } from "@/e2e/support/input";

export const legacyAvatarFragmentIds = [
  "clip0",
  "mask-id",
  "mouth-laugh-id",
  "path-id",
] as const;

const MarketingSurfaceSchema = Schema.Literals([
  "contributor-drawer",
  "community",
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
    return yield* MarketingContributorMissing.make({});
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
          unexpectedDuplicateIds: unexpectedDuplicateIds.sort(),
        };
      }, legacyAvatarFragmentIds)
    );

    if (!measurements.communityPresent) {
      return yield* MarketingSurfaceMissing.make({ surface: "community" });
    }
    return measurements;
  }
);

/** Dismisses the active contributor drawer through a real touch gesture. */
export const swipeContributorDrawer = Effect.fn(
  "NakafaE2E.swipeContributorDrawer"
)(function* (drawer: Locator, page: Page) {
  const bounds = yield* readBounds(drawer, "contributor-drawer");
  yield* swipeDown(page, bounds, { inset: 20, stopAt: "surface" });
});
