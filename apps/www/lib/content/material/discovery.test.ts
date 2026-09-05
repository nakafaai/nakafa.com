// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import { getHashBucket } from "@repo/backend/convex/contentRelease/bucket";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { Data, Effect } from "effect";
import {
  readPublishedLatestMaterials,
  readPublishedMaterialBucket,
} from "@/lib/content/material/discovery";
import { makeMaterialRuntimeSource } from "@/test/content/material";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import {
  createTestRuntimeQuery,
  createTestSnapshotQuery,
} from "@/test/runtime-query";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const runtimeReadMock = vi.hoisted(() => vi.fn());
const publicPath =
  "subjects/mathematics/function-composition-inverse-function/function-concept";
const sourcePath =
  "packages/corpus/material/lesson/mathematics/function-composition-inverse-function/function-concept/en.mdx";
const activeReleaseId = ReleaseIdSchema.make("release-material");

class TestMaterialRuntimeUnavailable extends Data.TaggedError(
  "TestMaterialRuntimeUnavailable"
)<{
  readonly operation: "query";
}> {}

vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: runtimeReadMock,
}));

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
  it.effect(
    "discovers bounded material metadata from authenticated serving rows",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeMaterialRuntimeSource();
        const context = yield* createTestSnapshotContext(fixture.source);
        runtimeReadMock.mockImplementation(createTestSnapshotQuery(context));
        const projection = makeMaterialProjection("en", 1);
        const bucket = getHashBucket(hashContentProjection(projection));

        const partition = yield* readPublishedMaterialBucket("en", bucket);
        expect(partition).toMatchObject({
          activeReleaseId: fixture.state.activeReleaseId,
          materials: expect.arrayContaining([
            expect.objectContaining({ publicPath: projection.publicPath }),
          ]),
        });
        const latest = yield* readPublishedLatestMaterials("en", 1);
        expect(latest.materials).toHaveLength(1);
        expect(latest.materials[0]).toMatchObject({
          publicPath: makeMaterialProjection("en", 2).publicPath,
        });
      })
  );

  beforeEach(() => {
    runtimeQueryMock.mockReset();
    runtimeReadMock.mockImplementation(
      createTestRuntimeQuery(runtimeQueryMock)
    );
  });

  it.effect("rejects unmanaged buckets and reads complete signed buckets", () =>
    Effect.gen(function* () {
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

      const unmanaged = yield* readPublishedMaterialBucket("en", "abc").pipe(
        Effect.flip
      );
      const inactive = yield* readPublishedMaterialBucket("en", "def").pipe(
        Effect.flip
      );
      const absent = yield* readPublishedMaterialBucket("en", "ghi");
      const published = yield* readPublishedMaterialBucket(
        "en",
        "jkl",
        activeReleaseId
      );

      expect(unmanaged).toMatchObject({ _tag: "PublishedProjectionError" });
      expect(inactive).toMatchObject({ _tag: "PublishedProjectionError" });
      expect(absent).toEqual({ activeReleaseId, materials: null });
      expect(published).toMatchObject({
        activeReleaseId,
        materials: [
          {
            publicPath,
            sourcePath,
          },
        ],
      });
    })
  );

  it.effect.each(["en", "id", "de"] as const)(
    "decodes newest %s materials from the expected release",
    (appLocale) =>
      Effect.gen(function* () {
        const {
          dateModified: _dateModified,
          description: _description,
          ...publishedOnly
        } = summary;
        runtimeQueryMock.mockResolvedValueOnce({
          activeReleaseId,
          managed: true,
          materials: [publishedOnly],
        });

        const result = yield* readPublishedLatestMaterials(
          appLocale,
          10,
          activeReleaseId
        );
        expect(result).toMatchObject({
          activeReleaseId,
          materials: [{ datePublished: summary.datePublished, sourcePath }],
        });
        expect(result.materials[0]).not.toHaveProperty("description");
        expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
          appLocale,
          limit: 10,
        });
      })
  );

  it.effect(
    "rejects malformed summaries, unmanaged results, and runtime failures",
    () =>
      Effect.gen(function* () {
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
          .mockRejectedValueOnce(
            new TestMaterialRuntimeUnavailable({ operation: "query" })
          );

        const malformed = yield* readPublishedMaterialBucket("en", "abc").pipe(
          Effect.flip
        );
        const unmanaged = yield* readPublishedLatestMaterials("en", 10).pipe(
          Effect.flip
        );
        const unavailable = yield* readPublishedLatestMaterials("en", 10).pipe(
          Effect.flip
        );

        expect(malformed).toMatchObject({ _tag: "PublishedProjectionError" });
        expect(unmanaged).toMatchObject({ _tag: "PublishedProjectionError" });
        expect(unavailable).toMatchObject({ _tag: "TestRuntimeQueryError" });
      })
  );

  it.effect.each(["en", "id", "de"] as const)(
    "rejects a %s material bucket from a different active release",
    (appLocale) =>
      Effect.gen(function* () {
        runtimeQueryMock.mockResolvedValueOnce({
          activeReleaseId: ReleaseIdSchema.make("release-next"),
          managed: true,
          materials: [summary],
        });

        const mismatch = yield* readPublishedMaterialBucket(
          appLocale,
          "abc",
          activeReleaseId
        ).pipe(Effect.flip);
        expect(mismatch).toMatchObject({
          _tag: "PublishedReleaseMismatchError",
          expectedReleaseId: activeReleaseId,
        });
      })
  );
});
