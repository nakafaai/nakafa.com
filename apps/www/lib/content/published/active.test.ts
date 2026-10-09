// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  createTestPublication,
  makeRuntimeSource,
  TEST_PUBLICATION_RELEASE,
} from "@repo/backend/test/content/publication";
import { Effect, Layer } from "effect";
import { readActiveContentIdentity } from "@/lib/content/published/active";

const fetchQueryMock = vi.hoisted(() => vi.fn());
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
            return {
              ...client,
              query: fetchQueryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});
beforeEach(() => {
  fetchQueryMock.mockReset();
});
describe("published active identity", () => {
  it.effect(
    "reads the active identity through the native publication query",
    () =>
      Effect.gen(function* () {
        const context = yield* createTestPublication(
          makeRuntimeSource().source
        );
        fetchQueryMock.mockImplementation(context.query);
        expect(yield* readActiveContentIdentity()).toEqual({
          manifestHash: TEST_PUBLICATION_RELEASE.manifestHash,
          releaseId: TEST_PUBLICATION_RELEASE.manifest.releaseId,
          sequence: 9,
        });
      })
  );
  it.effect(
    "reads the exact active release without another state interpretation",
    () =>
      Effect.gen(function* () {
        const identity = {
          manifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
          releaseId: ReleaseIdSchema.make("release-active"),
          sequence: 3,
        };
        fetchQueryMock.mockReturnValue(Effect.succeed(identity));
        expect(yield* readActiveContentIdentity()).toEqual(identity);
        expect(fetchQueryMock).toHaveBeenCalledWith(expect.anything(), {});
      })
  );
  it.effect("preserves the absence of an active release", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockReturnValue(Effect.succeed(null));
      expect(yield* readActiveContentIdentity()).toBeNull();
    })
  );
});
