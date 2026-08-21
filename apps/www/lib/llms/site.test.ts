// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  it("reads site routes from the active signed Page catalog", async () => {
    await expect(Effect.runPromise(readSiteLlmsEntries("en"))).resolves.toEqual(
      buildSiteLlmsEntries("en", [testPageProjection])
    );
    expect(catalogMock).toHaveBeenCalledOnce();
  });
});
