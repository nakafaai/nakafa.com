import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import {
  allocateSearchLimits,
  appendSearchGroups,
  interleaveSearchGroups,
} from "@repo/backend/convex/contents/helpers/search/groups";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

/** Builds one complete search document for deterministic group tests. */
function createDocument(slug: string) {
  const route = `articles/science/${slug}`;
  const identity = createLearningGraphIdentityFromRoute({
    locale: "en",
    route,
  });

  if (!identity) {
    expect.fail(`Expected graph identity for ${route}.`);
  }

  return buildContentSearchDocument({
    ...identity,
    contentHash: `hash-${slug}`,
    description: `${slug} description`,
    locale: "en",
    route,
    section: "articles",
    sourcePath: route,
    syncedAt: 1,
    text: `${slug} text`,
    title: slug,
  });
}

const FIRST = createDocument("first");
const SECOND = createDocument("second");
const THIRD = createDocument("third");

describe("search groups", () => {
  it("distributes one bounded read budget without losing candidates", () => {
    expect(allocateSearchLimits(8, 3)).toEqual([3, 3, 2]);
    expect(allocateSearchLimits(2, 4)).toEqual([1, 1, 0, 0]);
    expect(allocateSearchLimits(0, 3)).toEqual([]);
    expect(allocateSearchLimits(3, 0)).toEqual([]);
  });

  it("appends groups in priority order and removes duplicate identities", () => {
    expect(
      appendSearchGroups([
        [FIRST, SECOND],
        [SECOND, THIRD],
      ]).map((document) => document.title)
    ).toEqual(["first", "second", "third"]);
  });

  it("interleaves groups fairly and removes duplicate identities", () => {
    expect(
      interleaveSearchGroups([
        [FIRST, SECOND],
        [THIRD, FIRST],
      ]).map((document) => document.title)
    ).toEqual(["first", "third", "second"]);
  });
});
