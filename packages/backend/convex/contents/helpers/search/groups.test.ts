import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import {
  allocateSearchLimits,
  appendSearchGroups,
  interleaveSearchGroups,
  readSearchGroups,
} from "@repo/backend/convex/contents/helpers/search/groups";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { Effect } from "effect";
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

  it("refills unused group budget without exceeding the global limit", async () => {
    const calls: [string, number][] = [];

    const result = await Effect.runPromise(
      readSearchGroups(3, ["empty", "full"], (group, limit) => {
        calls.push([group, limit]);
        const documents = group === "empty" ? [] : [FIRST, SECOND, THIRD];
        return Effect.succeed(documents.slice(0, limit));
      })
    );

    expect(result.map((document) => document.title)).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(calls).toEqual([
      ["empty", 2],
      ["full", 1],
      ["full", 3],
    ]);
  });

  it("does not read groups without an allocated budget", async () => {
    const calls: [string, number][] = [];

    const result = await Effect.runPromise(
      readSearchGroups(2, ["first", "second", "unused"], (group, limit) => {
        calls.push([group, limit]);
        const document = group === "first" ? FIRST : SECOND;
        return Effect.succeed([document]);
      })
    );

    expect(result.map((document) => document.title)).toEqual([
      "first",
      "second",
    ]);
    expect(calls).toEqual([
      ["first", 1],
      ["second", 1],
    ]);
  });

  it("does not read when the global budget is empty", async () => {
    let calls = 0;

    const result = await Effect.runPromise(
      readSearchGroups(0, ["unused"], () => {
        calls += 1;
        return Effect.succeed([FIRST]);
      })
    );

    expect(result).toEqual([]);
    expect(calls).toBe(0);
  });
});
