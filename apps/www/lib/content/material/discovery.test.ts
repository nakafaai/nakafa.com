// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPublishedLatestMaterials,
  readPublishedMaterialBucket,
} from "@/lib/content/material/discovery";

const fetchMock = vi.hoisted(() => vi.fn());
const contentKey =
  "material/lesson/mathematics/function-composition-inverse-function/function-concept";
const publicPath =
  "subjects/mathematics/function-composition-inverse-function/function-concept";
const sourcePath =
  "packages/corpus/material/lesson/mathematics/function-composition-inverse-function/function-concept/en.mdx";
const activeReleaseId = ReleaseIdSchema.make("release-material");

vi.mock("@/lib/content/runtime/query", async () => {
  const { readTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    fetchRuntimeQuery: fetchMock,
    readRuntimeQuery: readTestRuntimeQuery,
  };
});

const summary = {
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "2025-04-27",
  description:
    "Understand functions as magic machines with interactive examples. Learn f(x) notation, input-output relationships, and the one-to-one rule.",
  publicPath,
  sourcePath,
  title: "Function Concept",
};

describe("published material discovery", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("reads missing and complete material buckets", async () => {
    fetchMock
      .mockResolvedValueOnce({
        activeReleaseId: null,
        managed: false,
        materials: null,
      })
      .mockResolvedValueOnce({
        activeReleaseId,
        managed: true,
        materials: [summary],
      });

    await expect(
      Effect.runPromise(readPublishedMaterialBucket("en", "abc"))
    ).resolves.toEqual({
      activeReleaseId: null,
      managed: false,
      materials: null,
    });
    await expect(
      Effect.runPromise(
        readPublishedMaterialBucket("en", "def", activeReleaseId)
      )
    ).resolves.toMatchObject({
      activeReleaseId,
      managed: true,
      materials: [
        {
          publicPath,
          sourcePath,
        },
      ],
    });
  });

  it("decodes newest materials and exact claimed source identities", async () => {
    fetchMock.mockResolvedValueOnce({
      claimedContentKeys: [contentKey],
      managed: false,
      materials: [summary],
    });

    await expect(
      Effect.runPromise(readPublishedLatestMaterials("en", 10))
    ).resolves.toMatchObject({
      claimedContentKeys: [contentKey],
      managed: false,
      materials: [{ sourcePath }],
    });
  });

  it("rejects malformed summaries and claimed identities", async () => {
    fetchMock
      .mockResolvedValueOnce({
        activeReleaseId,
        managed: true,
        materials: [{ ...summary, sourcePath: "" }],
      })
      .mockResolvedValueOnce({
        claimedContentKeys: [""],
        managed: false,
        materials: [],
      })
      .mockRejectedValueOnce(new Error("runtime unavailable"));

    await expect(
      Effect.runPromise(
        readPublishedMaterialBucket("en", "abc").pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    await expect(
      Effect.runPromise(
        readPublishedLatestMaterials("en", 10).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    await expect(
      Effect.runPromise(
        readPublishedLatestMaterials("en", 10).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "TestRuntimeQueryError" });
  });

  it("rejects a material bucket from a different active release", async () => {
    fetchMock.mockResolvedValueOnce({
      activeReleaseId: ReleaseIdSchema.make("release-next"),
      managed: true,
      materials: [summary],
    });

    await expect(
      Effect.runPromise(
        readPublishedMaterialBucket("en", "abc", activeReleaseId).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      expectedReleaseId: activeReleaseId,
    });
  });
});
