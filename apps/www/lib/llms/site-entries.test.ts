// @vitest-environment node
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
import { getSiteLlmsEntries } from "@/lib/llms/entries";

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRoute: () => Effect.succeed(null),
  getRuntimeContentRouteArtifactPage: () => Effect.succeed(null),
  getRuntimeContentRouteParentPage: () =>
    Effect.succeed({
      continueCursor: null,
      isDone: true,
      page: [],
    }),
}));

vi.mock("@/lib/llms/quran", () => ({
  getQuranRouteMetadata: () =>
    Effect.succeed({
      description: undefined,
      hasMarkdown: false,
      title: "Al-Quran",
    }),
}));

describe("site llms entries", () => {
  it("localizes mapped site routes in llms indexes", async () => {
    const englishEntries = await Effect.runPromise(getSiteLlmsEntries("en"));
    const indonesianEntries = await Effect.runPromise(getSiteLlmsEntries("id"));

    expect(englishEntries).toContainEqual(
      expect.objectContaining({
        href: `${BASE_URL}/en/curriculum`,
        route: "/curriculum",
        section: "site",
        title: "Curriculum",
      })
    );
    expect(indonesianEntries).toContainEqual(
      expect.objectContaining({
        href: `${BASE_URL}/id/kurikulum`,
        route: "/kurikulum",
        section: "site",
        title: "Kurikulum",
      })
    );
    expect(englishEntries.map((entry) => entry.href)).not.toContain(
      `${BASE_URL}/en/curricula`
    );
    expect(indonesianEntries.map((entry) => entry.href)).not.toContain(
      `${BASE_URL}/id/curricula`
    );
  });
});
