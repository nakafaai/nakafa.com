import { listPublicTryoutRoutes } from "@repo/contents/_types/route/tryout";
import { readStaticPublicTryoutRoutes } from "@repo/contents/_types/route/tryout/static";
import { defineTryoutExamSource } from "@repo/contents/_types/tryout/schema";
import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("readStaticPublicTryoutRoutes", () => {
  it("matches the validated default projection", () => {
    expect(readStaticPublicTryoutRoutes()).toEqual(
      Effect.runSync(listPublicTryoutRoutes())
    );
  });

  it("omits tracks whose sets have no authored questions", () => {
    const source = TRYOUT_SOURCES.find(
      (candidate) => candidate.examKey === "snbt"
    );
    const track = source?.tracks[0];
    const set = track?.sets[0];

    expect(source).toBeDefined();
    expect(track).toBeDefined();
    expect(set).toBeDefined();

    if (!(source && track && set)) {
      return;
    }

    const unreadySource = defineTryoutExamSource({
      ...source,
      tracks: [{ ...track, sets: [{ ...set, sections: [] }] }],
    });
    const routes = readStaticPublicTryoutRoutes({
      tryouts: [unreadySource],
    });

    expect(routes).toEqual(
      Effect.runSync(listPublicTryoutRoutes({ tryouts: [unreadySource] }))
    );
    expect(routes.some((route) => route.kind === "tryout-track")).toBe(false);
  });
});
