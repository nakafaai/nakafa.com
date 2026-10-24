// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readTryoutSetHandler } from "@/components/tryout/route/attempt.server";
import { readTryoutSectionHandler } from "@/components/tryout/route/section.server";

const mocks = vi.hoisted(() => ({
  readRequestToken: vi.fn(),
  renderTryoutPreview: vi.fn(),
  renderTryoutReview: vi.fn(),
  readTryoutQuestionPreview: vi.fn(),
  readTryoutSectionPage: vi.fn(),
  readTryoutSetPage: vi.fn(),
  setResponseHeader: vi.fn(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/en/try-out"),
  setResponseHeader: mocks.setResponseHeader,
}));
vi.mock("@/components/tryout/catalog/source.server", () => ({
  readTryoutSectionPage: mocks.readTryoutSectionPage,
  readTryoutSetPage: mocks.readTryoutSetPage,
}));
vi.mock("@/components/tryout/content/signed", () => ({
  loadSignedTryoutContent: vi.fn(),
}));
vi.mock("@/components/tryout/preview/read", () => ({
  readTryoutQuestionPreview: mocks.readTryoutQuestionPreview,
}));
vi.mock("@/components/tryout/route/rendered.server", () => ({
  renderTryoutPreview: mocks.renderTryoutPreview,
  renderTryoutReview: mocks.renderTryoutReview,
}));
vi.mock("@/components/tryout/route/token.server", () => ({
  readRequestToken: mocks.readRequestToken,
}));

const address = {
  country: "id",
  exam: "snbt",
  locale: "en",
  search: {},
  track: "2027",
} as const;

const NOT_FOUND = { kind: "notFound" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readRequestToken.mockReturnValue(Effect.succeedSome("token-1"));
  mocks.readTryoutQuestionPreview.mockReturnValue(Effect.succeedNone);
});

describe("try-out attempt server functions", () => {
  it("answers one set page for its learner at the set's address", async () => {
    mocks.readTryoutSetPage.mockReturnValueOnce(Effect.void);

    await expect(
      readTryoutSetHandler({ data: { ...address, set: "set-1" } })
    ).resolves.toEqual(NOT_FOUND);
    expect(mocks.readTryoutSetPage).toHaveBeenCalledExactlyOnceWith(
      "en",
      "try-out/id/snbt/2027/set-1"
    );
  });

  it("answers one section page for its learner at the section's address", async () => {
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
