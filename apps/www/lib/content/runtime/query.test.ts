// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { Context, Effect } from "effect";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

const { fetchMock, snapshotMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  snapshotMock: vi.fn(),
}));
vi.mock("convex/nextjs", () => ({ fetchQuery: fetchMock }));
vi.mock("@/lib/content/runtime/snapshot", () => ({
  loadContentSnapshot: snapshotMock,
}));
vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://selected.example" },
}));

const query = api.contentRelease.runtime.active.read;
const identity = {
  manifestHash: "manifest",
  releaseId: "release",
  sequence: 4,
};

beforeEach(() => {
  fetchMock.mockReset();
  snapshotMock.mockReset().mockResolvedValue(undefined);
});

describe("content runtime query", () => {
  it("uses native Convex reads when no build snapshot is selected", async () => {
    const read = vi.fn(() => Effect.succeed(null));
    fetchMock.mockResolvedValue(identity);
    await expect(fetchRuntimeQuery(query, {}, read)).resolves.toEqual(identity);
    expect(fetchMock).toHaveBeenCalledWith(
      query,
      {},
      { url: "https://selected.example" }
    );
    expect(read).not.toHaveBeenCalled();
  });

  it("executes the canonical program against the selected build context", async () => {
    snapshotMock.mockResolvedValue(Context.empty());
    const read = vi.fn(() => Effect.succeed(identity));
    await expect(fetchRuntimeQuery(query, {}, read)).resolves.toEqual(identity);
    expect(read).toHaveBeenCalledWith({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.effect("keeps successful reads inside the domain error channel", () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(identity);
      expect(
        yield* readRuntimeQuery(query, {}, () => Effect.succeed(null))
      ).toEqual(identity);
    })
  );

  it.effect(
    "does not fall back to live data after snapshot authentication fails",
    () =>
      Effect.gen(function* () {
        snapshotMock.mockRejectedValue(new Error("Snapshot hash mismatch"));
        const failure = yield* readRuntimeQuery(query, {}, () =>
          Effect.succeed(null)
        ).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "NakafaAgentDataReadError",
          cause: "Snapshot hash mismatch",
        });
        expect(fetchMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "preserves a native transport failure as a typed read failure",
    () =>
      Effect.gen(function* () {
        fetchMock.mockRejectedValue(new Error("Connection closed"));
        const failure = yield* readRuntimeQuery(query, {}, () =>
          Effect.succeed(null)
        ).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "NakafaAgentDataReadError",
          cause: "Connection closed",
        });
      })
  );
});
