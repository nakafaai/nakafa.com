// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readTryoutSetHandler } from "@/components/tryout/route/attempt.server";
import { readTryoutSectionHandler } from "@/components/tryout/route/section.server";

const mocks = vi.hoisted(() => ({
  readTryoutMetadata: vi.fn(),
  readTryoutSectionPage: vi.fn(),
  readTryoutSetPage: vi.fn(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/en/try-out"),
}));
vi.mock("@/components/tryout/catalog/source.server", () => ({
  readTryoutMetadata: mocks.readTryoutMetadata,
  readTryoutSectionPage: mocks.readTryoutSectionPage,
  readTryoutSetPage: mocks.readTryoutSetPage,
}));

const address = {
  country: "id",
  exam: "snbt",
  locale: "en",
  track: "2027",
} as const;

const NOT_FOUND = { kind: "notFound" };

beforeEach(() => {
  vi.clearAllMocks();
  // The set's page and its head are read together, so a missing page still reads the head.
  mocks.readTryoutMetadata.mockReturnValue(Effect.succeed({ route: null }));
});

describe("try-out attempt server functions", () => {
  it("answers one set page at the set's address", async () => {
    mocks.readTryoutSetPage.mockReturnValueOnce(Effect.void);

    await expect(
      readTryoutSetHandler({ data: { ...address, set: "set-1" } })
    ).resolves.toEqual(NOT_FOUND);
    expect(mocks.readTryoutSetPage).toHaveBeenCalledExactlyOnceWith(
      "en",
      "try-out/id/snbt/2027/set-1"
    );
  });

  it("answers one section page at the section's address", async () => {
    mocks.readTryoutSectionPage.mockReturnValueOnce(Effect.void);

    await expect(
      readTryoutSectionHandler({
        data: { ...address, section: "section-1", set: "set-1" },
      })
    ).resolves.toEqual(NOT_FOUND);
    expect(mocks.readTryoutSectionPage).toHaveBeenCalledExactlyOnceWith(
      "en",
      "try-out/id/snbt/2027/set-1/section-1"
    );
  });
});
