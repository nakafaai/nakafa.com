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
import { Effect } from "effect";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import {
  createTestNativeQuery,
  createTestRuntimeQuery,
} from "@/test/runtime-query";

const fetchQueryMock = vi.hoisted(() => vi.fn());
const readQueryMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/client/nakafa/query", () => ({
  readNakafaRuntimeQuery: readQueryMock,
}));

beforeEach(() => {
  fetchQueryMock.mockReset();
  readQueryMock.mockReset();
  readQueryMock.mockImplementation(createTestRuntimeQuery(fetchQueryMock));
});

describe("published active identity", () => {
  it.effect(
    "reads the active identity through the native publication query",
    () =>
      Effect.gen(function* () {
        const context = yield* createTestPublication(
          makeRuntimeSource().source
        );
        readQueryMock.mockImplementation(createTestNativeQuery(context));

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
        fetchQueryMock.mockResolvedValue(identity);

        expect(yield* readActiveContentIdentity()).toEqual(identity);
        expect(readQueryMock).toHaveBeenCalledWith(
          "https://test.convex.cloud",
          expect.anything(),
          {}
        );
      })
  );

  it.effect("preserves the absence of an active release", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockResolvedValue(null);

      expect(yield* readActiveContentIdentity()).toBeNull();
    })
  );
});

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" },
}));
