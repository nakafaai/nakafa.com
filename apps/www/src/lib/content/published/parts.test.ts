// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect, Layer, Schema } from "effect";
import {
  readPublicArtifact,
  readReleaseFrame,
} from "@/lib/content/published/parts";

const fetchQueryMock = vi.hoisted(() => vi.fn());
const pinnedQueryMock = vi.hoisted(() => vi.fn());
/** The immutable store on a miss: it runs the load it was given. */
const immutableReadMock = vi.hoisted(() =>
  vi.fn(({ load }: { readonly load: unknown }) => load)
);

vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return { ...client, query: fetchQueryMock };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});
vi.mock("@/lib/content/store/query", () => ({
  queryPinnedContentStore: pinnedQueryMock,
}));
vi.mock("@/lib/content/store/read", () => ({
  readImmutableContentStore: immutableReadMock,
}));

const release = ReleaseIdSchema.make("release-a");
const args = {
  appLocale: "en",
  artifactHash: `sha256:${"a".repeat(64)}`,
  family: "material",
  publicPath: "subjects/test/lesson",
} as const;

beforeEach(() => {
  fetchQueryMock.mockReset();
  pinnedQueryMock.mockReset();
  immutableReadMock.mockClear();
});

describe("published content parts", () => {
  it.effect("reads a release's frame pinned to the release it names", () =>
    Effect.gen(function* () {
      const frame = {
        activeManifestHash: `sha256:${"b".repeat(64)}`,
        activeReleaseId: release,
        releaseJson: "{}",
        rendererJson: "{}",
      };
      pinnedQueryMock.mockReturnValue(Effect.succeed(frame));

      expect(yield* readReleaseFrame(release)).toBe(frame);
      expect(pinnedQueryMock).toHaveBeenCalledExactlyOnceWith(
        release,
        contentRelease.runtime.active.frame,
        {}
      );
    })
  );

  it.effect(
    "keeps an artifact by its hash alone and answers nothing for a hash the route no longer names",
    () =>
      Effect.gen(function* () {
        fetchQueryMock
          .mockReturnValueOnce(Effect.succeed({ artifactJson: "signed" }))
          .mockReturnValueOnce(Effect.succeed(null));

        expect(yield* readPublicArtifact(args)).toBe("signed");
        expect(yield* readPublicArtifact(args)).toBeNull();
        expect(immutableReadMock).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: contentRelease.runtime.active.artifact.convexFunctionName,
            parts: [args.artifactHash],
            schema: Schema.String,
          })
        );
        expect(fetchQueryMock).toHaveBeenCalledWith(
          contentRelease.runtime.active.artifact,
          args
        );
      })
  );
});
