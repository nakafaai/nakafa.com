// @vitest-environment node

import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

const { fetchMock, runtimeUrl } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  runtimeUrl: "https://runtime.example",
}));

vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: fetchMock,
}));

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: runtimeUrl },
}));

describe("content runtime query", () => {
  it("reads one official Convex runtime query", async () => {
    const response = { activeReleaseId: null, sourceClaims: [] };
    fetchMock.mockResolvedValueOnce(response);

    await expect(
      fetchRuntimeQuery(api.contentRelease.material.claims, {
        sourceCandidates: [],
      })
    ).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledWith(
      runtimeUrl,
      api.contentRelease.material.claims,
      { sourceCandidates: [] }
    );
  });

  it("maps runtime failures into the typed data-read error", async () => {
    await expect(
      Effect.runPromise(readRuntimeQuery("success", () => Promise.resolve(42)))
    ).resolves.toBe(42);
    await expect(
      Effect.runPromise(
        Effect.flip(
          readRuntimeQuery("failure", () =>
            Promise.reject(new Error("network unavailable"))
          )
        )
      )
    ).resolves.toMatchObject({
      _tag: "NakafaAgentDataReadError",
      cause: "network unavailable",
      message: "Unable to read Nakafa runtime content query: failure.",
    });
  });
});
