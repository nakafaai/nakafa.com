// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import { createTestRuntimeQuery } from "@/test/runtime-query";

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
        expect(readQueryMock).toHaveBeenCalledWith(expect.anything(), {});
      })
  );

  it.effect("preserves the absence of an active release", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockResolvedValue(null);

      expect(yield* readActiveContentIdentity()).toBeNull();
    })
  );
});
