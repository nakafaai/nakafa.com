// @vitest-environment node

import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

const { readMock, runtimeUrl } = vi.hoisted(() => ({
  readMock: vi.fn(),
  runtimeUrl: "https://runtime.example",
}));

vi.mock("@repo/backend/client/runtime", async (importOriginal) => ({
  ...(await importOriginal()),
  readConvexRuntimeQuery: readMock,
}));

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: runtimeUrl },
}));

describe("content runtime query", () => {
  it("maps the Effect runtime query into the typed data-read channel", async () => {
    readMock.mockReturnValueOnce(Effect.succeed(42));
    await expect(
      Effect.runPromise(
        readRuntimeQuery(api.contentRelease.material.claims, {
          sourceCandidates: [],
        })
      )
    ).resolves.toBe(42);

    const runtimeError = new ConvexRuntimeQueryError({
      networkCodes: ["EPIPE"],
      query: "contentRelease.material.route",
      reason: "transport",
    });
    readMock.mockReturnValueOnce(Effect.fail(runtimeError));
    await expect(
      Effect.runPromise(
        Effect.flip(
          readRuntimeQuery(api.contentRelease.material.claims, {
            sourceCandidates: [],
          })
        )
      )
    ).resolves.toMatchObject({
      cause: runtimeError.message,
      message:
        "Unable to read Nakafa runtime content query: contentRelease.material.route.",
    });
    expect(readMock).toHaveBeenCalledWith(
      runtimeUrl,
      api.contentRelease.material.claims,
      { sourceCandidates: [] }
    );
  });
});
