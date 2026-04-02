import { mergePopularAudioContentItems } from "@repo/backend/convex/contents/helpers/popularity";
import { describe, expect, it } from "vitest";

describe("contents/helpers/popularity", () => {
  it("keeps the highest-view source row for one slug and filters low-volume items", () => {
    const items = mergePopularAudioContentItems([
      {
        ref: { type: "subject", id: "sd71" as never },
        sourceContent: {
          contentHash: "hash-en-low",
          locale: "en",
          ref: { type: "subject", id: "sd71" as never },
          slug: "subject/high-school/10/mathematics/vector-operations/vector-addition",
        },
        viewCount: 20,
      },
      {
        ref: { type: "subject", id: "sd72" as never },
        sourceContent: {
          contentHash: "hash-id-high",
          locale: "id",
          ref: { type: "subject", id: "sd72" as never },
          slug: "subject/high-school/10/mathematics/vector-operations/vector-addition",
        },
        viewCount: 35,
      },
      {
        ref: { type: "article", id: "ar71" as never },
        sourceContent: {
          contentHash: "hash-article",
          locale: "en",
          ref: { type: "article", id: "ar71" as never },
          slug: "articles/politics/dynastic-politics-asian-values",
        },
        viewCount: 9,
      },
    ]);

    expect(items).toEqual([
      {
        ref: { type: "subject", id: "sd72" },
        sourceContent: {
          contentHash: "hash-id-high",
          locale: "id",
          ref: { type: "subject", id: "sd72" },
          slug: "subject/high-school/10/mathematics/vector-operations/vector-addition",
        },
        viewCount: 35,
      },
    ]);
  });

  it("falls back to ref identity when source lookup metadata is missing", () => {
    const items = mergePopularAudioContentItems([
      {
        ref: { type: "article", id: "ar72" as never },
        viewCount: 15,
      },
      {
        ref: { type: "article", id: "ar71" as never },
        viewCount: 30,
      },
    ]);

    expect(items).toEqual([
      {
        ref: { type: "article", id: "ar71" },
        viewCount: 30,
      },
      {
        ref: { type: "article", id: "ar72" },
        viewCount: 15,
      },
    ]);
  });
});
