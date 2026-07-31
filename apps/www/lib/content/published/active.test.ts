// @vitest-environment node

import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchActiveContentIdentity,
  getActiveContentIdentity,
  readActiveContentIdentity,
} from "@/lib/content/published/active";
import { readTestRuntimeQuery } from "@/test/runtime-query";

const applyContentRuntimeCacheMock = vi.hoisted(() => vi.fn());
const fetchQueryMock = vi.hoisted(() => vi.fn());
const readQueryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: applyContentRuntimeCacheMock,
}));
vi.mock("@/lib/content/runtime/query", () => ({
  fetchRuntimeQuery: fetchQueryMock,
  readRuntimeQuery: readQueryMock,
}));

beforeEach(() => {
  applyContentRuntimeCacheMock.mockReset();
  fetchQueryMock.mockReset();
  readQueryMock.mockReset();
  readQueryMock.mockImplementation(readTestRuntimeQuery);
});

describe("published active identity", () => {
  it("reads the exact active release without another state interpretation", async () => {
    const identity = {
      manifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
      releaseId: ReleaseIdSchema.make("release-active"),
      sequence: 3,
    };
    fetchQueryMock.mockResolvedValue(identity);

    await expect(
      Effect.runPromise(readActiveContentIdentity())
    ).resolves.toEqual(identity);
    expect(readQueryMock).toHaveBeenCalledWith(
      "contentRelease.runtime.active.read",
      expect.any(Function)
    );
  });

  it("preserves the absence of an active release", async () => {
    fetchQueryMock.mockResolvedValue(null);

    await expect(
      Effect.runPromise(readActiveContentIdentity())
    ).resolves.toBeNull();
  });

  it("decodes the framework-safe active identity", async () => {
    const identity = {
      manifestHash: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
      releaseId: ReleaseIdSchema.make("release-static"),
      sequence: 4,
    };
    fetchQueryMock.mockResolvedValue(identity);

    await expect(fetchActiveContentIdentity()).resolves.toEqual(identity);
  });

  it("rejects malformed framework-safe active identity", async () => {
    fetchQueryMock.mockResolvedValue({ releaseId: "invalid release" });

    await expect(fetchActiveContentIdentity()).rejects.toMatchObject({
      _tag: "ParseError",
    });
  });

  it("applies global invalidation to the cached framework boundary", async () => {
    fetchQueryMock.mockResolvedValue(null);

    await expect(getActiveContentIdentity()).resolves.toBeNull();
    expect(applyContentRuntimeCacheMock).toHaveBeenCalledOnce();
  });
});
