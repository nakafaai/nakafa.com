// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readActiveContentIdentity } from "@/lib/content/published/active";

const fetchQueryMock = vi.hoisted(() => vi.fn());
const readQueryMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content/runtime/query", () => ({
  fetchRuntimeQuery: fetchQueryMock,
  readRuntimeQuery: readQueryMock,
}));

beforeEach(() => {
  fetchQueryMock.mockReset();
  readQueryMock.mockReset();
  readQueryMock.mockImplementation(
    (_name: string, read: () => Promise<unknown>) =>
      Effect.tryPromise({ catch: () => new Error("read"), try: read })
  );
});

describe("published active identity", () => {
  it("reads the exact active release without another state interpretation", async () => {
    const identity = {
      manifestHash: `sha256:${"a".repeat(64)}`,
      releaseId: "release-active",
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
});
