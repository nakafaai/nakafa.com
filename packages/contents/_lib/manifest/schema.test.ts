import { buildContentRouteManifest } from "@repo/contents/_lib/manifest/build";
import { buildContentPublicRouteManifest } from "@repo/contents/_lib/manifest/public-routes-build";
import { getRouteRoots } from "@repo/contents/_lib/manifest/routes";
import {
  ContentManifestRouteSchema,
  ContentRouteManifestDecodeError,
} from "@repo/contents/_lib/manifest/schema";
import {
  ContentRouteSource,
  getFolderNamesOrEmpty,
} from "@repo/contents/_lib/manifest/source";
import {
  DirectoryReadError,
  InvalidPathError,
} from "@repo/contents/_shared/error";
import { Effect, Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("ContentManifestRouteSchema", () => {
  it("accepts safe absolute routes and rejects unsafe routes", () => {
    expect(Schema.decodeUnknownSync(ContentManifestRouteSchema)("/")).toBe("/");
    expect(
      Schema.decodeUnknownSync(ContentManifestRouteSchema)("/quran/1")
    ).toBe("/quran/1");
    expect(() =>
      Schema.decodeUnknownSync(ContentManifestRouteSchema)("quran/1")
    ).toThrow("Expected a safe absolute content manifest route.");
    expect(() =>
      Schema.decodeUnknownSync(ContentManifestRouteSchema)("/quran//1")
    ).toThrow("Expected a safe absolute content manifest route.");
  });
});

describe("content manifest support modules", () => {
  it("ignores empty route roots", () => {
    expect(getRouteRoots(["", "/kurikulum/merdeka"])).toEqual(["/kurikulum"]);
  });

  it("treats invalid folder paths as empty route groups", () => {
    const source = ContentRouteSource.make({
      clearFolderCache: Effect.void,
      getFolderCacheVersion: Effect.succeed(1),
      getFolderNames: () =>
        Effect.fail(
          new InvalidPathError({
            message: "Invalid test path.",
            path: "../bad",
            reason: "Path escapes the content root.",
          })
        ),
      getMdxSlugs: () => Effect.succeed([]),
      getNestedSlugParts: () => Effect.succeed([]),
      getQuranRoutes: Effect.succeed([]),
    });

    const folders = Effect.runSync(getFolderNamesOrEmpty(source, "../bad"));

    expect(folders).toEqual([]);
  });

  it("treats unreadable folders as empty route groups", () => {
    const source = ContentRouteSource.make({
      clearFolderCache: Effect.void,
      getFolderCacheVersion: Effect.succeed(1),
      getFolderNames: () =>
        Effect.fail(
          new DirectoryReadError({
            cause: new Error("missing"),
            message: "Unable to read test directory.",
            path: "missing-folder",
          })
        ),
      getMdxSlugs: () => Effect.succeed([]),
      getNestedSlugParts: () => Effect.succeed([]),
      getQuranRoutes: Effect.succeed([]),
    });

    const folders = Effect.runSync(getFolderNamesOrEmpty(source, "missing"));

    expect(folders).toEqual([]);
  });

  it("maps schema failures into a manifest decode error", async () => {
    const source = ContentRouteSource.make({
      clearFolderCache: Effect.void,
      getFolderCacheVersion: Effect.succeed(1),
      getFolderNames: () => Effect.succeed([]),
      getMdxSlugs: () => Effect.succeed([]),
      getNestedSlugParts: () => Effect.succeed([]),
      getQuranRoutes: Effect.succeed(["quran/1"]),
    });
    const result = await Effect.runPromise(
      Effect.either(
        buildContentRouteManifest(["en"]).pipe(
          Effect.provideService(ContentRouteSource, source)
        )
      )
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(ContentRouteManifestDecodeError);
    }
  });

  it("maps public route schema failures into a manifest decode error", async () => {
    const source = ContentRouteSource.make({
      clearFolderCache: Effect.void,
      getFolderCacheVersion: Effect.succeed(1),
      getFolderNames: () => Effect.succeed([]),
      getMdxSlugs: () => Effect.succeed([]),
      getNestedSlugParts: () => Effect.succeed([]),
      getQuranRoutes: Effect.succeed(["quran/1"]),
    });
    const result = await Effect.runPromise(
      Effect.either(
        buildContentPublicRouteManifest(["en"]).pipe(
          Effect.provideService(ContentRouteSource, source)
        )
      )
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(ContentRouteManifestDecodeError);
    }
  });
});
