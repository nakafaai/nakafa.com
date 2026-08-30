// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
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
                "Compare Nakafa Free and Pro for learning materials, practice questions, Nina AI tutoring, and online Tryouts.",
              route: "/pricing",
              title: "Pricing",
            },
          ]
        )
      );
      expect(catalogMock).toHaveBeenCalledOnce();
    })
  );
});
