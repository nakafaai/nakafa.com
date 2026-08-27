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
      expect(yield* readSiteLlmsEntries("en")).toEqual(
        buildSiteLlmsEntries("en", [testPageProjection])
      );
      expect(catalogMock).toHaveBeenCalledOnce();
    })
  );
});
