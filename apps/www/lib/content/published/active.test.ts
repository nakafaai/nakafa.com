// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  makeRuntimeSource,
  TEST_SNAPSHOT_RELEASE,
} from "@repo/backend/test/content/snapshot";
import { Effect } from "effect";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import {
  createTestRuntimeQuery,
  createTestSnapshotQuery,
} from "@/test/runtime-query";

const fetchQueryMock = vi.hoisted(() => vi.fn());
const readQueryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: readQueryMock,
}));

beforeEach(() => {
  fetchQueryMock.mockReset();
  readQueryMock.mockReset();
  readQueryMock.mockImplementation(createTestRuntimeQuery(fetchQueryMock));
});

describe("published active identity", () => {
  it.effect(
    "reads the active identity from the authenticated build snapshot",
    () =>
      Effect.gen(function* () {
        const context = yield* createTestSnapshotContext(
          makeRuntimeSource().source
        );
        readQueryMock.mockImplementation(createTestSnapshotQuery(context));

        expect(yield* readActiveContentIdentity()).toEqual({
          manifestHash: TEST_SNAPSHOT_RELEASE.manifestHash,
          releaseId: TEST_SNAPSHOT_RELEASE.manifest.releaseId,
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
          expect.anything(),
          {},
          expect.any(Function)
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
