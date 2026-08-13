import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import {
  appendSearchGroups,
  interleaveSearchGroups,
} from "@repo/backend/convex/contents/helpers/search/groups";
import { testArticleGraph } from "@repo/backend/test/content-release";
import { describe, expect, it } from "vitest";

/** Builds one complete search document for deterministic group tests. */
function createDocument(slug: string) {
  const route = `articles/science/${slug}`;
  const identity = testArticleGraph(slug);

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
const FOURTH = createDocument("fourth");

describe("search groups", () => {
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
      interleaveSearchGroups(
        [
          [FIRST, SECOND],
          [THIRD, FIRST],
        ],
        3,
        (document) => document.content_id
      ).map((document) => document.title)
    ).toEqual(["first", "third", "second"]);
  });

  it("keeps every smaller page as a prefix of one fixed ordering", () => {
    const groups = [[], [FIRST, SECOND], [THIRD, FOURTH], [FIRST, FOURTH]];
    const identify = (document: typeof FIRST) => document.content_id;
    const firstPage = interleaveSearchGroups(groups, 2, identify);
    const fullWindow = interleaveSearchGroups(groups, 4, identify);

    expect(firstPage).toEqual(fullWindow.slice(0, firstPage.length));
    expect(interleaveSearchGroups(groups, 0, identify)).toEqual([]);
  });
});
