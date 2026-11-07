// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { buildSiteLlmsEntries } from "@/lib/llms/entries";
import { readSiteLlmsEntries } from "@/lib/llms/site";
import { testPageProjection } from "@/test/content-page";

const catalogMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/page/catalog", () => ({
  readPublishedPageCatalog: catalogMock,
}));

beforeEach(() => {
  catalogMock.mockReset().mockReturnValue(
    Effect.succeed({
      activeReleaseId: "release-pages",
      projections: [testPageProjection],
    })
  );
});

describe("site llms entries", () => {
  it.effect("reads site routes from the active signed Page catalog", () =>
    Effect.gen(function* () {
      const entries = yield* readSiteLlmsEntries("en");
      expect(entries).toEqual(
        buildSiteLlmsEntries(
          "en",
          [testPageProjection],
          [
            {
              description:
                "Compare Nakafa Free and Pro for learning materials, practice questions, Nina AI tutoring, and online try outs.",
              route: "/pricing",
              title: "Pricing",
            },
            {
              description: en.SchoolSite["metadata-description"],
              route: "/school",
              title: en.SchoolSite["metadata-title"],
            },
            {
              description: en.SchoolSite["pricing-metadata-description"],
              route: "/school/pricing",
              title: en.SchoolSite["pricing-metadata-title"],
            },
          ]
        )
      );
      expect(catalogMock).toHaveBeenCalledOnce();
    })
  );
});
