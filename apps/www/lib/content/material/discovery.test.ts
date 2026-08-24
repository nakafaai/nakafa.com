// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPublishedLatestMaterials,
  readPublishedMaterialBucket,
} from "@/lib/content/material/discovery";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const publicPath =
  "subjects/mathematics/function-composition-inverse-function/function-concept";
const sourcePath =
  "packages/corpus/material/lesson/mathematics/function-composition-inverse-function/function-concept/en.mdx";
const activeReleaseId = ReleaseIdSchema.make("release-material");

vi.mock("@/lib/content/runtime/query", async () => {
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
  };
});

const summary = {
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  dateModified: "2026-08-22",
  datePublished: "2025-04-27",
  description:
    "Understand functions as magic machines with interactive examples. Learn f(x) notation, input-output relationships, and the one-to-one rule.",
  publicPath,
  sourcePath,
  title: "Function Concept",
};

describe("published material discovery", () => {
  beforeEach(() => {
    runtimeQueryMock.mockReset();
  });

  it("rejects unmanaged buckets and reads complete signed buckets", async () => {
    runtimeQueryMock
      .mockResolvedValueOnce({
        activeReleaseId,
        managed: false,
        materials: null,
      })
      .mockResolvedValueOnce({
        activeReleaseId: null,
        managed: true,
        materials: null,
      })
      .mockResolvedValueOnce({
        activeReleaseId,
        managed: true,
        materials: null,
      })
      .mockResolvedValueOnce({
        activeReleaseId,
        managed: true,
        materials: [summary],
      });

    await expect(
      Effect.runPromise(
        readPublishedMaterialBucket("en", "abc").pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    await expect(
      Effect.runPromise(
        readPublishedMaterialBucket("en", "def").pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    await expect(
      Effect.runPromise(readPublishedMaterialBucket("en", "ghi"))
    ).resolves.toEqual({ activeReleaseId, materials: null });
    await expect(
      Effect.runPromise(
        readPublishedMaterialBucket("en", "jkl", activeReleaseId)
      )
    ).resolves.toMatchObject({
      activeReleaseId,
      materials: [
        {
          publicPath,
          sourcePath,
        },
      ],
    });
  });

  it.each(["en", "id", "de"] as const)(
    "decodes newest %s materials from the expected release",
    async (appLocale) => {
      const { dateModified: _dateModified, ...publishedOnly } = summary;
      runtimeQueryMock.mockResolvedValueOnce({
        activeReleaseId,
        managed: true,
        materials: [publishedOnly],
      });

      await expect(
        Effect.runPromise(
          readPublishedLatestMaterials(appLocale, 10, activeReleaseId)
        )
      ).resolves.toMatchObject({
        activeReleaseId,
        materials: [{ datePublished: summary.datePublished, sourcePath }],
      });
      expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
        appLocale,
        limit: 10,
      });
    }
  );

  it("rejects malformed summaries, unmanaged results, and runtime failures", async () => {
    runtimeQueryMock
      .mockResolvedValueOnce({
        activeReleaseId,
        managed: true,
        materials: [{ ...summary, sourcePath: "" }],
      })
      .mockResolvedValueOnce({
        activeReleaseId,
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

  it.each(["en", "id", "de"] as const)(
    "rejects a %s material bucket from a different active release",
    async (appLocale) => {
      runtimeQueryMock.mockResolvedValueOnce({
        activeReleaseId: ReleaseIdSchema.make("release-next"),
        managed: true,
        materials: [summary],
      });

      await expect(
        Effect.runPromise(
          readPublishedMaterialBucket(appLocale, "abc", activeReleaseId).pipe(
            Effect.flip
          )
        )
      ).resolves.toMatchObject({
        _tag: "PublishedReleaseMismatchError",
        expectedReleaseId: activeReleaseId,
      });
    }
  );
});
