// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readTryoutSetRoute } from "@/components/tryout/route/attempt.server";

const mocks = vi.hoisted(() => ({
  readTryoutRouteHead: vi.fn(),
  readTryoutSetPage: vi.fn(),
}));

vi.mock("@/components/tryout/catalog/source.server", () => ({
  readTryoutSetPage: mocks.readTryoutSetPage,
}));
vi.mock("@/components/tryout/route/catalog.server", () => ({
  readTryoutRouteHead: mocks.readTryoutRouteHead,
}));

const SET = "try-out/id/snbt/2027/set-1";
const head = {
  canonicalPath: `/en/${SET}`,
  description: "Set 1",
  image: "og-url",
  indexable: true,
  title: "Set 1",
};
const address = {
  country: "id",
  exam: "snbt",
  locale: "en",
  set: "set-1",
  track: "2027",
} as const;
const catalogSet = {
  entrySection: { sectionKey: "section-1" },
  set: { publicPath: SET, title: "Set 1" },
  sections: [{ publicPath: `${SET}/section-1` }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readTryoutSetPage.mockReturnValue(Effect.succeed(catalogSet));
  mocks.readTryoutRouteHead.mockReturnValue(Effect.succeedSome(head));
});

describe("readTryoutSetRoute", () => {
  it.effect("answers the set's catalog view with the set to start", () =>
    Effect.gen(function* () {
      expect(yield* readTryoutSetRoute(address)).toMatchObject({
        head,
        kind: "catalog",
        page: catalogSet,
        restartTarget: {
          entrySection: { sectionKey: "section-1" },
          setPublicPath: SET,
        },
        route: address,
      });
      expect(mocks.readTryoutSetPage).toHaveBeenCalledExactlyOnceWith(
        "en",
        SET
      );
    })
  );

  it.effect(
    "answers not found when the catalog has no set page or no head",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutSetPage.mockReturnValueOnce(Effect.void);
        expect(yield* readTryoutSetRoute(address)).toEqual({
          kind: "notFound",
        });

        mocks.readTryoutRouteHead.mockReturnValueOnce(Effect.succeedNone);
        expect(yield* readTryoutSetRoute(address)).toEqual({
          kind: "notFound",
        });
      })
  );
});
