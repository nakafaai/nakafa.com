import { expect, type Page } from "@playwright/test";
import type { Contributor } from "@repo/contents/contributor";
import { Effect, Schema } from "effect";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { openRoute } from "@/e2e/support/route";
import { MARKETING_PAGE } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const MarketingSurfaceSchema = Schema.Literals(["community"]);

/** The fixed contributor fixture does not contain its required first row. */
class MarketingContributorMissing extends Schema.TaggedError<MarketingContributorMissing>()(
  "MarketingContributorMissing",
  {}
) {
  get message() {
    return "The marketing contributor fixture is empty.";
  }
}

/** One required homepage surface was absent from the rendered document. */
class MarketingSurfaceMissing extends Schema.TaggedError<MarketingSurfaceMissing>()(
  "MarketingSurfaceMissing",
  { surface: MarketingSurfaceSchema }
) {
  get message() {
    return `Marketing surface is missing: surface=${this.surface}.`;
  }
}

/** Reads the required first contributor without inventing fixture data. */
/** Opens one marketing page and waits until its visible route boundary is on screen. */
export const loadMarketingPage = Effect.fn("NakafaE2E.loadMarketingPage")(
  function* (page: Page, href: string) {
    yield* openRoute(page, href, "denied");
    yield* waitForCommittedAppRouter(
      page,
      href,
      href,
      readinessTimeoutMilliseconds
    );
    /**
     * Next.js may commit App Router history before React reveals a streamed route.
     * Keep the existing readiness budget attached to the visible route boundary.
     * @see https://nextjs.org/docs/app/getting-started/linking-and-navigating#streaming
     */
    yield* Effect.promise(() =>
      expect(
        page.locator(MARKETING_PAGE).filter({ visible: true })
      ).toHaveCount(1, { timeout: readinessTimeoutMilliseconds })
    );
  }
);

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
      page.evaluate(() => {
        const community = document.querySelector("#community");
        const ids = [...document.querySelectorAll("[id]")].map(({ id }) => id);
        const duplicateIds = [
          ...new Set(ids.filter((id, index) => ids.indexOf(id) !== index)),
        ];
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
          duplicateIds: duplicateIds.sort(),
          homepageDescendants: document.body.querySelectorAll("*").length,
          missingFragmentReferences: [
            ...new Set(
              fragmentReferences.filter(
                (fragmentId) => !document.getElementById(fragmentId)
              )
            ),
          ],
        };
      })
    );

    if (!measurements.communityPresent) {
      return yield* new MarketingSurfaceMissing({ surface: "community" });
    }
    return measurements;
  }
);
